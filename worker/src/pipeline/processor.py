import os
import json
import tempfile
import pymupdf
import httpx
from typing import Dict, Any, List
from src.providers.storage import get_storage_provider
from src.providers.ocr import get_ocr_provider
from src.providers.llm import get_llm_provider

# Configurable confidence threshold from engineering specification
CONFIDENCE_THRESHOLD = 0.80

class DocumentProcessor:
    def __init__(self):
        self.storage = get_storage_provider()
        self.ocr = get_ocr_provider()
        self.llm = get_llm_provider()

    def _fetch_course_topics(self, course_code: str) -> List[str]:
        """Fetch the real syllabus topics for a course from the database via API."""
        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.get("http://localhost:3000/api/courses")
                if res.status_code == 200:
                    data = res.json()
                    for course in data.get("courses", []):
                        if course.get("code") == course_code:
                            topics = []
                            for module in course.get("modules", []):
                                for topic in module.get("topics", []):
                                    topics.append(topic.get("topicName", ""))
                            if topics:
                                print(f"[Pipeline] Loaded {len(topics)} candidate topics for {course_code}.")
                                return topics
        except Exception as e:
            print(f"[Pipeline] Could not fetch course topics: {e}")
        return []

    def process_job(self, job_id: str, file_record: dict) -> dict:
        """
        Executes the staged pipeline:
        validation -> extraction (scanned OCR for papers, native for materials)
        -> question segmentation -> topic classification -> confidence evaluation -> review routing -> DB update
        """
        s3_key = file_record.get('s3Key', '')
        document_type = file_record.get('documentType', 'PYQ')
        course_code = file_record.get('courseCode', 'UNKNOWN')
        year = file_record.get('year')

        print(f"\n=======================================================")
        print(f"[Pipeline] Processing Job {job_id}")
        print(f"[Pipeline] Document Type: {document_type} | Course: {course_code} | File: {s3_key}")
        print(f"=======================================================")

        # Use tempfile for safe, unique temporary paths
        tmp_dir = tempfile.mkdtemp(prefix=f"cpyq_{job_id[:8]}_")
        local_path = os.path.join(tmp_dir, "document.pdf")

        # ------------------------------------------------------------------
        # Stage 1: DOWNLOAD & STORAGE VALIDATION
        # ------------------------------------------------------------------
        print("[Pipeline] Stage 1: DOWNLOADING & VALIDATION")
        downloaded = self.storage.download_file(s3_key, local_path)
        if not downloaded:
            print(f"[Pipeline] Error: File {s3_key} could not be downloaded from storage.")
            self._update_job_status(job_id, "FAILED", "DOWNLOADING", [], [])
            return {
                "success": False,
                "status": "FAILED",
                "stage": "DOWNLOADING",
                "error": f"File '{s3_key}' not found in storage."
            }

        # ------------------------------------------------------------------
        # Stage 2: EXTRACTION
        # PYQ Papers -> Dedicated Scanned Image Rendering & OCR
        # Study Materials -> Deterministic Native Text with OCR Fallback
        # ------------------------------------------------------------------
        print(f"[Pipeline] Stage 2: TEXT_EXTRACTION ({document_type})")
        if document_type == 'PYQ':
            extracted_text, ocr_confidence = self.ocr.extract_paper_text(local_path)
        else:
            extracted_text, ocr_confidence = self.ocr.extract_material_text(local_path)

        if not extracted_text:
            self._update_job_status(job_id, "FAILED", "TEXT_EXTRACTION", [], [])
            return {
                "success": False,
                "status": "FAILED",
                "stage": "TEXT_EXTRACTION",
                "error": "No legible text could be extracted from document."
            }

        # ------------------------------------------------------------------
        # Stage 3: QUESTION SEGMENTATION (Atomic Subquestions)
        # ------------------------------------------------------------------
        print("[Pipeline] Stage 3: QUESTION_SEGMENTATION")
        questions = self.llm.segment_questions(extracted_text)

        # ------------------------------------------------------------------
        # Stage 4: TOPIC CLASSIFICATION & CONFIDENCE SCORING
        # ------------------------------------------------------------------
        print("[Pipeline] Stage 4: CLASSIFICATION")
        low_confidence_reasons: List[str] = []

        if ocr_confidence < CONFIDENCE_THRESHOLD:
            low_confidence_reasons.append(f"OCR mean confidence ({ocr_confidence:.2f}) below threshold ({CONFIDENCE_THRESHOLD})")

        # Fetch real syllabus topics for this course
        candidate_topics = self._fetch_course_topics(course_code)

        # Generate question crop paths & classify topics
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.abspath(os.path.join(current_dir, '..', '..', '..'))
        year_label = str(year) if year else "unknown"
        crops_dir = os.path.join(root_dir, 'local_storage', 'crops', str(course_code), year_label)
        os.makedirs(crops_dir, exist_ok=True)

        for q in questions:
            q_num = q.get('questionNumber', 'Q')
            clean_q_num = q_num.replace("(", "").replace(")", "").replace(" ", "_")
            crop_rel_path = f"crops/{course_code}/{year_label}/{clean_q_num}.png"
            q['imageCropS3Key'] = crop_rel_path

            # Create an image crop placeholder for verification
            crop_abs_path = os.path.join(crops_dir, f"{clean_q_num}.png")
            if not os.path.exists(crop_abs_path):
                try:
                    doc = pymupdf.open(local_path)
                    if len(doc) > 0:
                        pix = doc[0].get_pixmap(dpi=150)
                        pix.save(crop_abs_path)
                    doc.close()
                except Exception:
                    pass

            classification = self.llm.classify_question(q['extractedText'], candidate_topics=candidate_topics or None)
            topic = classification.get('topicName', 'General')
            conf = classification.get('confidence', 0.85)
            q['topic'] = topic
            q['confidence'] = conf

            if conf < CONFIDENCE_THRESHOLD:
                low_confidence_reasons.append(f"{q_num} topic confidence ({conf:.2f}) below threshold ({CONFIDENCE_THRESHOLD})")

        # ------------------------------------------------------------------
        # Stage 5: CONFIDENCE EVALUATION & REVIEW ROUTING
        # ------------------------------------------------------------------
        if low_confidence_reasons:
            final_status = "REVIEW_REQUIRED"
            print(f"[Pipeline] Route: REVIEW_REQUIRED -> {', '.join(low_confidence_reasons)}")
        else:
            final_status = "COMPLETED"
            print(f"[Pipeline] Route: COMPLETED (High confidence on all {len(questions)} questions)")

        # ------------------------------------------------------------------
        # Stage 6: UPDATE DATABASE STATUS & PERSIST QUESTIONS
        # ------------------------------------------------------------------
        self._update_job_status(job_id, final_status, "COMPLETED", low_confidence_reasons, questions)

        # Cleanup local working copy
        try:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass

        return {
            "success": True,
            "jobId": job_id,
            "documentType": document_type,
            "status": final_status,
            "ocrConfidence": round(ocr_confidence, 2),
            "reviewReasons": low_confidence_reasons,
            "questions": questions,
            "extractedTextLength": len(extracted_text)
        }

    def _update_job_status(self, job_id: str, status: str, stage: str, review_reasons: List[str], questions: List[Dict]):
        """Persist job status and extracted questions back to PostgreSQL via the Next.js API."""
        try:
            with httpx.Client(timeout=15.0) as client:
                update_res = client.post(
                    "http://localhost:3000/api/jobs/update",
                    json={
                        "jobId": job_id,
                        "status": status,
                        "stage": stage,
                        "reviewReasons": review_reasons,
                        "questions": questions
                    }
                )
                if update_res.status_code == 200:
                    print(f"[Pipeline] Successfully persisted status '{status}' and {len(questions)} questions in PostgreSQL.")
                else:
                    print(f"[Pipeline] Warning: DB update returned {update_res.status_code}: {update_res.text[:200]}")
        except Exception as update_err:
            print(f"[Pipeline] Database update communication error: {update_err}")
