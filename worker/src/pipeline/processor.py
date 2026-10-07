"""Small outbound document pipeline using owner cloud keys and queue leases."""
import hashlib
import os
import tempfile
from pathlib import Path
import pymupdf as fitz
import httpx
from src.providers.cloud import CloudExtractor, EXTRACTION_VERSION, ProviderFailure
from src.providers.storage import get_storage_provider
from src.pipeline.materials import MATERIAL_EXTRACTION_VERSION, extract_material_page

FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')

class DocumentProcessor:
    def __init__(self):
        self.storage = get_storage_provider()
        self.cloud = CloudExtractor()

    def process_job(self, job_id, record):
        headers = {'x-internal-worker-key': os.getenv('WORKER_INTERNAL_KEY', '')}
        result = {'jobId': job_id, 'leaseToken': record['leaseToken'], 'status': 'RETRY_PENDING', 'stage': 'CLOUD_EXTRACTION', 'questions': [], 'reviewReasons': [], 'extractionVersion': EXTRACTION_VERSION}
        with httpx.Client(timeout=150, headers=headers) as client:
            try:
                with tempfile.TemporaryDirectory(prefix='cpyq-') as directory:
                    path = os.path.join(directory, 'document.pdf')
                    if not self.storage.download_file(record['s3Key'], path):
                        raise ProviderFailure('Could not download PDF; check storage configuration')
                    content = Path(path).read_bytes()
                    if len(content) > 25 * 1024 * 1024:
                        raise ProviderFailure('PDF exceeds the 25 MB processing limit')
                    result['fileHash'] = hashlib.sha256(content).hexdigest()
                    with fitz.open(path) as pdf:
                        if pdf.needs_pass or not 0 < len(pdf) <= 200:
                            raise ProviderFailure('PDF must be readable, unencrypted and have 1–200 pages')
                        page_count = len(pdf)
                    response = client.get(f'{FRONTEND_URL}/api/jobs/context', params={'jobId': job_id}, headers={'x-job-lease': record['leaseToken']})
                    response.raise_for_status()
                    context = response.json()
                    result['syllabusVersionId'] = context['syllabusVersionId']
                    if record['documentType'] == 'STUDY_MATERIAL':
                        result['extractionVersion'] = MATERIAL_EXTRACTION_VERSION
                        result['stage'] = 'NOTES_EXTRACTION'
                        result['pageCount'] = page_count
                        cached = {page['pageIndex']: page for page in (context.get('material') or {}).get('pages', [])
                                  if page['fileHash'] == result['fileHash'] and page['extractionVersion'] == MATERIAL_EXTRACTION_VERSION}
                        with fitz.open(path) as pdf:
                            for index, page in enumerate(pdf):
                                if index in cached:
                                    continue
                                checkpoint = extract_material_page(page, index, self.cloud)
                                response = client.post(f'{FRONTEND_URL}/api/jobs/material-page', json={
                                    'jobId': job_id, 'leaseToken': record['leaseToken'], 'fileHash': result['fileHash'],
                                    'extractionVersion': MATERIAL_EXTRACTION_VERSION, 'pageCount': page_count, 'page': checkpoint})
                                response.raise_for_status()
                        result.update(status='AUTO_PUBLISHED', materialComplete=True, reviewedPages=list(range(page_count)), provider='native-or-cloud', stage='NOTES_COMPLETE')
                        return self._save(client, result)
                    # Duplicate lookup is version-aware. Legacy papers are re-extracted.
                    if record['documentType'] == 'PYQ':
                        duplicate = client.get(f'{FRONTEND_URL}/api/files/check-hash', params={'hash': result['fileHash'], 'jobId': job_id})
                        duplicate.raise_for_status()
                        original = duplicate.json()
                        if original.get('exists') and original.get('analysisComplete') and original.get('syllabusVersionId') == context['syllabusVersionId']:
                            result.update(status='AUTO_PUBLISHED', stage='DUPLICATE_REUSE', duplicateOfPaperId=original['paperId'], questions=original['questions'], analysisComplete=True, sharedInstructions=original.get('sharedInstructions', ''), pageCount=original.get('pageCount', page_count), reviewedPages=list(range(page_count)))
                            if original.get('year'):
                                result['year'] = original['year']
                            return self._save(client, result)
                    if record['documentType'] not in ('PYQ', 'CURRICULUM'):
                        raise ProviderFailure('Only syllabi and question-paper PDFs are supported')
                    extraction = self.cloud.extract(path, record['documentType'], page_count)
                    reasons = list(extraction.issues)
                    if not extraction.complete:
                        reasons.append('Cloud extraction is incomplete; retry or reupload a clearer PDF')
                    if extraction.courseCode and extraction.courseCode.upper() != record['courseCode']:
                        reasons.append('Course code conflicts with printed header')
                    if extraction.examType and extraction.examType != record.get('examType') and record['documentType'] == 'PYQ':
                        reasons.append('Exam type conflicts with printed header')
                    if extraction.year and record.get('year') and extraction.year != record['year']:
                        reasons.append('Year conflicts with printed header')
                    result.update(provider=self.cloud.provider, pageCount=page_count, reviewedPages=extraction.reviewedPages, sharedInstructions=extraction.sharedInstructions)
                    if record['documentType'] == 'CURRICULUM':
                        if not extraction.modules or extraction.questions:
                            reasons.append('Syllabus modules missing or document is not a curriculum')
                        result['curriculum'] = {'modules': [module.model_dump() for module in extraction.modules]} if extraction.modules else None
                    else:
                        questions = [question.model_dump() for question in extraction.questions]
                        labels = [question['questionNumber'] for question in questions]
                        if not labels or len(labels) != len(set(labels)) or sorted(labels) != sorted(extraction.questionLabels):
                            reasons.append('Question inventory is missing, repeated or incomplete')
                        for question in questions:
                            if any(not 0 <= page < page_count for page in question['sourcePages']):
                                reasons.append('Invalid source-page reference')
                            question['pageIndex'] = question['sourcePages'][0]
                        if not context['syllabusVersionId'] or not context['topics']:
                            reasons.append('An analysed syllabus is required before paper publication')
                        if not reasons:
                            atomic = [question for question in questions if question['marksScope'] != 'PARENT_TOTAL']
                            assignments = self.cloud.classify(atomic, context).assignments
                            assigned = {assignment.questionNumber: assignment for assignment in assignments}
                            if len(assignments) != len(atomic) or set(assigned) != {question['questionNumber'] for question in atomic}:
                                reasons.append('Classification omitted or repeated question labels')
                            valid_topics = {topic['id'] for topic in context['topics']}
                            valid_patterns = {pattern['id'] for pattern in context['patterns']}
                            for question in atomic:
                                assignment = assigned.get(question['questionNumber'])
                                if not assignment:
                                    continue
                                if not set(assignment.topicIds) <= valid_topics or (assignment.patternId and assignment.patternId not in valid_patterns):
                                    reasons.append('Classification used an unknown syllabus topic or pattern')
                                question.update(assignment.model_dump(exclude={'questionNumber'}))
                        result['questions'] = questions
                        result['analysisComplete'] = not reasons
                        if extraction.year or record.get('year'):
                            result['year'] = extraction.year or record['year']
                    result['reviewReasons'] = list(dict.fromkeys(reasons))
                    result['status'] = 'RETRY_PENDING' if reasons else 'AUTO_PUBLISHED'
                    result['qualityMetrics'] = {'ocrConfidence': 1 if not reasons else 0, 'segmentationCoverage': 1 if extraction.complete else 0, 'questionCount': len(result['questions']), 'checks': {'cloudDeclaredComplete': extraction.complete, 'reviewedPages': extraction.reviewedPages, 'questionLabels': extraction.questionLabels}}
                    return self._save(client, result)
            except Exception as error:
                reason = str(error) if isinstance(error, ProviderFailure) else f'Cloud processing failed ({type(error).__name__}); check configuration and retry'
                print(f'[Pipeline] Job {job_id}: {reason}', flush=True)
                result.update(status='RETRY_PENDING', analysisComplete=False, reviewReasons=[reason], stage='FAILED')
                if isinstance(error, ProviderFailure) and error.retry_after:
                    result['retryAfterSeconds'] = error.retry_after
                return self._save(client, result)

    def _save(self, client, result):
        if result.get('curriculum') is None:
            result.pop('curriculum', None)
        response = client.post(f'{FRONTEND_URL}/api/jobs/update', json=result)
        response.raise_for_status()
        return {'status': result['status']}
