import os
import re
import json
import hashlib
import tempfile
import pymupdf
import httpx
from typing import Dict, Any, List, Optional
from pydantic import ValidationError
from src.providers.storage import get_storage_provider
from src.providers.ocr import get_ocr_provider
from src.providers.llm import get_llm_provider
from src.schemas import CoursesResponse, CheckHashResponse

# Configurable confidence threshold from engineering specification
CONFIDENCE_THRESHOLD = 0.80

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

def _detect_year(text: str) -> Optional[int]:
    """Detect academic year from text headers, e.g. 'March 2025', '2024-25', 'Winter 2024', '2023'."""
    # Academic year range e.g. 2024-25 or 2024-2025 -> pick later year
    range_match = re.search(r'\b20(\d{2})[-/](?:20)?(\d{2})\b', text)
    if range_match:
        y2 = int(range_match.group(2))
        return 2000 + y2 if y2 < 100 else y2

    # Month / Term + Year e.g. "March 2025", "Winter 2024"
    term_match = re.search(
        r'\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|fall|winter|spring|summer)\s+[\'"]?(201\d|202\d)\b',
        text,
        re.IGNORECASE
    )
    if term_match:
        return int(term_match.group(1))

    # Standard 4-digit year (2015-2029)
    year_match = re.search(r'\b(201[5-9]|202[0-9])\b', text)
    if year_match:
        return int(year_match.group(1))

    return None

class DocumentProcessor:
    def __init__(self):
        self.storage = get_storage_provider()
        self.ocr = get_ocr_provider()
        self.llm = get_llm_provider()

    def _fetch_course_topics(self, course_code: str) -> List[str]:
        """Fetch the real syllabus topics for a course from the database via API."""
        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.get(f"{FRONTEND_URL}/api/courses")
                if res.status_code == 200:
                    try:
                        parsed = CoursesResponse.model_validate(res.json())
                    except ValidationError as ve:
                        print(f"[Pipeline] /api/courses response failed contract validation: {ve}")
                        return []
                    for course in parsed.courses:
                        if course.code == course_code:
                            topics = [t.topicName for m in course.modules for t in m.topics if t.topicName]
                            if topics:
                                print(f"[Pipeline] Loaded {len(topics)} candidate topics for {course_code}.")
                                return topics
        except Exception as e:
            print(f"[Pipeline] Could not fetch course topics: {e}")
        return []

    def _check_duplicate_hash(self, file_hash: str, job_id: str) -> Optional[Dict]:
        """Check if an identical file has already been ingested into PostgreSQL."""
        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.get(f"{FRONTEND_URL}/api/files/check-hash?hash={file_hash}&jobId={job_id}")
                if res.status_code == 200:
                    try:
                        return CheckHashResponse.model_validate(res.json()).model_dump()
                    except ValidationError as ve:
                        print(f"[Pipeline] /api/files/check-hash response failed contract validation: {ve}")
                        return None
        except Exception as err:
            print(f"[Pipeline] Duplicate check notice ({err}). Proceeding with standard ingestion.")
        return None

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

        # SHA-256 Duplicate PDF Detection
        file_hash = None
        try:
            with open(local_path, 'rb') as f:
                file_hash = hashlib.sha256(f.read()).hexdigest()
            print(f"[Pipeline] SHA-256: {file_hash}")
        except Exception as hash_err:
            print(f"[Pipeline] Hash computation error: {hash_err}")

        if file_hash:
            dupe_check = self._check_duplicate_hash(file_hash, job_id)
            if dupe_check and dupe_check.get('exists'):
                existing_questions = dupe_check.get('questions', [])
                existing_year = dupe_check.get('year') or year
                print(f"[Pipeline] Exact duplicate PDF detected (matches existing file {dupe_check.get('existingFileId')})!")
                print(f"[Pipeline] Reusing {len(existing_questions)} pre-extracted questions. Zero GPU/LLM calls needed.")
                self._update_job_status(job_id, "COMPLETED", "COMPLETED", [], existing_questions, year=existing_year, file_hash=file_hash)
                try:
                    import shutil
                    shutil.rmtree(tmp_dir, ignore_errors=True)
                except Exception:
                    pass
                return {
                    "success": True,
                    "jobId": job_id,
                    "documentType": document_type,
                    "status": "COMPLETED",
                    "duplicate": True,
                    "existingFileId": dupe_check.get('existingFileId'),
                    "questions": existing_questions,
                    "questionsCount": len(existing_questions)
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
        if not year:
            year = _detect_year(extracted_text)

        year_label = str(year) if year else "unknown"
        crops_dir = os.path.join(root_dir, 'local_storage', 'crops', str(course_code), year_label)
        os.makedirs(crops_dir, exist_ok=True)

        # Map each question to its corresponding PDF page and generate accurate crop
        pages_raw = re.split(r'--- (?:Question Paper Page|Slide/Page|Page) (\d+) ---', extracted_text)
        page_texts: Dict[int, str] = {}
        for i in range(1, len(pages_raw), 2):
            try:
                page_texts[int(pages_raw[i])] = pages_raw[i + 1]
            except (ValueError, IndexError):
                pass

        try:
            pdf_doc = pymupdf.open(local_path)
        except Exception as doc_err:
            print(f"[Pipeline] Could not open PDF for crop extraction: {doc_err}")
            pdf_doc = None

        # 1. Determine target page for each question via keyword overlap
        for q in questions:
            target_page_idx = 0
            if page_texts:
                best_overlap = -1
                q_words = set(re.findall(r'\w{3,}', q.get('extractedText', '').lower()))
                for p_num, p_txt in page_texts.items():
                    p_words = set(re.findall(r'\w{3,}', p_txt.lower()))
                    overlap = len(q_words.intersection(p_words))
                    if overlap > best_overlap:
                        best_overlap = overlap
                        target_page_idx = max(0, p_num - 1)
            q['target_page_idx'] = target_page_idx

        # 2. Extract crops grouped by page with accurate bounding boxes
        if pdf_doc:
            for p_idx in range(len(pdf_doc)):
                page_obj = pdf_doc[p_idx]
                page_qs = [q for q in questions if q.get('target_page_idx', 0) == p_idx]
                if not page_qs:
                    continue

                # Locate vertical start coordinate (y0) for each question on this page
                located_qs = []
                for idx, q in enumerate(page_qs):
                    q_num = q.get('questionNumber', 'Q')
                    search_rects = page_obj.search_for(q_num)
                    y0 = -1
                    if search_rects:
                        y0 = search_rects[0].y0
                    else:
                        # Search by distinctive words from question start
                        words = [w for w in re.findall(r'[A-Za-z0-9]+', q.get('extractedText', '')) if len(w) > 3][:4]
                        if len(words) >= 2:
                            s_rects = page_obj.search_for(' '.join(words[:2]))
                            if s_rects:
                                y0 = s_rects[0].y0
                        if y0 == -1 and words:
                            s_rects = page_obj.search_for(words[0])
                            if s_rects:
                                y0 = s_rects[0].y0
                    located_qs.append((q, y0, idx))

                page_h = page_obj.rect.height
                page_w = page_obj.rect.width
                total_in_page = len(page_qs)

                for q, y0, idx in located_qs:
                    q_num = q.get('questionNumber', 'Q')
                    clean_q_num = q_num.replace("(", "").replace(")", "").replace(" ", "_")
                    crop_rel_path = f"crops/{course_code}/{year_label}/{clean_q_num}.png"
                    crop_abs_path = os.path.join(crops_dir, f"{clean_q_num}.png")
                    q['imageCropS3Key'] = crop_rel_path

                    if y0 >= 0:
                        top_y = max(0, y0 - 15)
                        next_y = page_h
                        for _, next_y0_cand, _ in located_qs:
                            if next_y0_cand > y0 + 15 and next_y0_cand < next_y:
                                next_y = next_y0_cand
                        bot_y = min(page_h, max(top_y + 150, next_y - 5))
                        clip_rect = pymupdf.Rect(0, top_y, page_w, bot_y)
                    else:
                        # Proportional vertical band slice (guarantees question snippet, never full page)
                        band_h = page_h / total_in_page
                        clip_rect = pymupdf.Rect(0, band_h * idx, page_w, band_h * (idx + 1))

                    try:
                        pix = page_obj.get_pixmap(clip=clip_rect, dpi=150)
                        pix.save(crop_abs_path)
                    except Exception as crop_err:
                        print(f"[Pipeline] Crop generation note for {clean_q_num}: {crop_err}")

            pdf_doc.close()

        # 3. Topic classification for ALL questions — single batch API call
        # Ensure every question has its imageCropS3Key set
        for q in questions:
            q_num = q.get('questionNumber', 'Q')
            clean_q_num = q_num.replace("(", "").replace(")", "").replace(" ", "_")
            if 'imageCropS3Key' not in q:
                q['imageCropS3Key'] = f"crops/{course_code}/{year_label}/{clean_q_num}.png"

        # Batch classify: 1 Gemini call for ALL questions instead of N calls
        batch_results = self.llm.classify_questions_batch(questions, candidate_topics=candidate_topics or None)

        # Build lookup from batch results
        batch_lookup: Dict[str, Dict] = {}
        for br in batch_results:
            batch_lookup[br.get('questionNumber', '')] = br

        for q in questions:
            q_num = q.get('questionNumber', 'Q')
            match = batch_lookup.get(q_num, {})
            topic = match.get('topicName', 'General')
            conf = float(match.get('confidence', 0.85))
            q['topic'] = topic
            q['confidence'] = conf

            if conf < CONFIDENCE_THRESHOLD:
                low_confidence_reasons.append(f"{q_num} topic confidence ({conf:.2f}) below threshold ({CONFIDENCE_THRESHOLD})")

        # ------------------------------------------------------------------
        # Stage 4b: SEMANTIC EMBEDDING (for pgvector similarity search)
        # 1 batched Gemini call for every question in this paper. A missing/failed
        # embedding is not a review-routing concern - it just means that question
        # isn't semantically searchable yet, so it never affects final_status below.
        # ------------------------------------------------------------------
        print("[Pipeline] Stage 4b: SEMANTIC_EMBEDDING")
        embeddings = self.llm.embed_questions([q.get('extractedText', '') for q in questions])
        for q, embedding in zip(questions, embeddings):
            q['embedding'] = embedding

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
        self._update_job_status(job_id, final_status, "COMPLETED", low_confidence_reasons, questions, year=year, file_hash=file_hash)

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

    def _update_job_status(self, job_id: str, status: str, stage: str, review_reasons: List[str], questions: List[Dict], year: Any = None, file_hash: str = None):
        """Persist job status and extracted questions back to PostgreSQL via the Next.js API."""
        try:
            payload = {
                "jobId": job_id,
                "status": status,
                "stage": stage,
                "reviewReasons": review_reasons,
                "questions": questions
            }
            if year:
                payload["year"] = int(year)
            if file_hash:
                payload["fileHash"] = file_hash

            with httpx.Client(timeout=15.0) as client:
                update_res = client.post(
                    f"{FRONTEND_URL}/api/jobs/update",
                    json=payload,
                    headers={"x-internal-worker-key": os.environ.get("WORKER_INTERNAL_KEY", "")}
                )
                if update_res.status_code == 200:
                    print(f"[Pipeline] Successfully persisted status '{status}' and {len(questions)} questions in PostgreSQL.")
                else:
                    print(f"[Pipeline] Warning: DB update returned {update_res.status_code}: {update_res.text[:200]}")
        except Exception as update_err:
            print(f"[Pipeline] Database update communication error: {update_err}")
