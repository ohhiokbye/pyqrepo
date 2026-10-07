from test_ingestion_v1 import run_pipeline, paper


def test_unknown_syllabus_ids_block_publication(monkeypatch, tmp_path):
    result, _, _ = run_pipeline(monkeypatch, tmp_path, extraction=paper(), assignments=[{'questionNumber': 'Q1', 'topicIds': ['foreign-course-topic'], 'patternDescription': 'Hashing'}])
    assert result['status'] == 'RETRY_PENDING'


def test_missing_assignment_blocks_publication(monkeypatch, tmp_path):
    result, _, _ = run_pipeline(monkeypatch, tmp_path, extraction=paper(), assignments=[])
    assert result['status'] == 'RETRY_PENDING'


def test_multi_topic_assignment_survives_pipeline(monkeypatch, tmp_path):
    context = {'syllabusVersionId': 'syllabus-1', 'topics': [{'id': 'hashing'}, {'id': 'complexity'}], 'patterns': []}
    result, _, _ = run_pipeline(monkeypatch, tmp_path, extraction=paper(), context=context, assignments=[{'questionNumber': 'Q1', 'topicIds': ['hashing', 'complexity'], 'patternDescription': 'Hashing complexity'}])
    assert result['status'] == 'AUTO_PUBLISHED'
    assert result['questions'][0]['topicIds'] == ['hashing', 'complexity']
