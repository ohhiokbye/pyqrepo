"""Exercise the current lightweight worker against real PDFs and a fake job API."""
import hashlib
import json
from types import SimpleNamespace
import httpx
import pymupdf
import pytest
from src.pipeline import processor
from src.providers.cloud import DocumentExtraction, Assignments, ProviderFailure


def run_pipeline(monkeypatch, tmp_path, document_type='PYQ', extraction=None, assignments=None, context=None, cached=None, cloud_failure=None):
    path = tmp_path / 'source.pdf'
    with pymupdf.open() as pdf:
        for _ in range(2):
            page = pdf.new_page()
            page.insert_text((50, 50), 'Hashing collisions use chaining or open addressing. Explain the algorithm and its complexity.')
        pdf.save(path)
    content = path.read_bytes()
    checkpoints, results = [], []
    job_context = context or {'syllabusVersionId': 'syllabus-1', 'topics': [{'id': 'hashing'}], 'patterns': []}
    cached_pages = cached(hashlib.sha256(content).hexdigest()) if callable(cached) else (cached or [])
    job_context = {**job_context, 'material': {'id': 'notes-1', 'pages': cached_pages}}
    real_client = httpx.Client
    def handler(request):
        if request.url.path.endswith('/context'):
            assert request.headers['x-job-lease'] == 'lease-1'
            return httpx.Response(200, json=job_context)
        if request.url.path.endswith('/check-hash'):
            return httpx.Response(200, json={'exists': False})
        payload = json.loads(request.content)
        if request.url.path.endswith('/material-page'):
            checkpoints.append(payload['page'])
        else:
            results.append(payload)
        return httpx.Response(200, json={'success': True})
    monkeypatch.setattr(processor.httpx, 'Client', lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))
    worker = object.__new__(processor.DocumentProcessor)
    def download(key, destination):
        from pathlib import Path
        Path(destination).write_bytes(content)
        return True
    def extract(*args):
        if cloud_failure:
            raise cloud_failure
        return DocumentExtraction.model_validate(extraction)
    worker.storage = SimpleNamespace(download_file=download)
    worker.cloud = SimpleNamespace(provider='fixture', extract=extract, classify=lambda *args: Assignments.model_validate({'assignments': assignments or []}))
    worker.process_job('job-1', {'leaseToken': 'lease-1', 's3Key': 'source.pdf', 'documentType': document_type, 'courseCode': 'BCSE302L', 'examType': 'CAT2', 'year': 2025})
    return results[-1], checkpoints, hashlib.sha256(content).hexdigest()


def paper(**changes):
    return {'complete': True, 'issues': [], 'reviewedPages': [0, 1], 'questionLabels': ['Q1'], 'modules': [], 'questions': [{'questionNumber': 'Q1', 'extractedText': 'Explain hashing collisions.', 'sourcePages': [0], 'marks': None}], **changes}


def test_native_notes_checkpoint_every_page_and_do_not_call_cloud(monkeypatch, tmp_path):
    result, checkpoints, _ = run_pipeline(monkeypatch, tmp_path, 'STUDY_MATERIAL')
    assert result['status'] == 'AUTO_PUBLISHED'
    assert result['materialComplete'] is True
    assert result['extractionVersion'] == 'notes-v1'
    assert [p['pageIndex'] for p in checkpoints] == [0, 1]
    assert all(p['method'] == 'native' for p in checkpoints)


def test_current_paper_keeps_unknown_marks_and_uses_syllabus_ids(monkeypatch, tmp_path):
    result, _, _ = run_pipeline(monkeypatch, tmp_path, extraction=paper(), assignments=[{'questionNumber': 'Q1', 'topicIds': ['hashing'], 'patternDescription': 'Hashing collision resolution'}])
    assert result['status'] == 'AUTO_PUBLISHED'
    assert result['questions'][0]['marks'] is None
    assert result['questions'][0]['topicIds'] == ['hashing']


@pytest.mark.parametrize('changes', [
    {'complete': False}, {'questionLabels': ['Q1', 'Q2']}, {'courseCode': 'OTHER'},
    {'examType': 'FAT'}, {'year': 2024},
    {'questions': [{'questionNumber': 'Q1', 'extractedText': 'Hashing', 'sourcePages': [5]}]},
])
def test_incomplete_or_conflicting_papers_remain_private(monkeypatch, tmp_path, changes):
    result, _, _ = run_pipeline(monkeypatch, tmp_path, extraction=paper(**changes))
    assert result['status'] == 'RETRY_PENDING'
    assert result['reviewReasons']
    assert result['analysisComplete'] is False


def test_quota_retry_delay_is_forwarded_without_credentials(monkeypatch, tmp_path, capsys):
    result, _, _ = run_pipeline(monkeypatch, tmp_path, cloud_failure=ProviderFailure('quota unavailable', retry_after=600))
    assert result['retryAfterSeconds'] == 600
    assert result['status'] == 'RETRY_PENDING'
    assert 'api_key' not in capsys.readouterr().out


def test_notes_retry_reuses_matching_page_checkpoint(monkeypatch, tmp_path):
    def cached(file_hash):
        return [{'pageIndex': 0, 'text': 'Previously extracted text', 'heading': '', 'method': 'native', 'fileHash': file_hash, 'extractionVersion': 'notes-v1'}]
    result, checkpoints, _ = run_pipeline(monkeypatch, tmp_path, 'STUDY_MATERIAL', cached=cached)
    assert result['materialComplete'] is True
    assert [page['pageIndex'] for page in checkpoints] == [1]


def test_changed_pdf_does_not_reuse_stale_checkpoint(monkeypatch, tmp_path):
    cached = [{'pageIndex': 0, 'fileHash': '0' * 64, 'extractionVersion': 'notes-v1'}]
    result, checkpoints, _ = run_pipeline(monkeypatch, tmp_path, 'STUDY_MATERIAL', cached=cached)
    assert result['materialComplete'] is True
    assert [page['pageIndex'] for page in checkpoints] == [0, 1]
