from test_ingestion_v1 import run_pipeline


def test_cloud_curriculum_extracts_explicit_modules_and_topics(monkeypatch, tmp_path):
    extraction = {'complete': True, 'issues': [], 'reviewedPages': [0, 1], 'questionLabels': [], 'questions': [], 'modules': [{'moduleNo': 1, 'name': 'Relational Model', 'topics': ['Relations', 'Keys']}]}
    result, _, _ = run_pipeline(monkeypatch, tmp_path, 'CURRICULUM', extraction=extraction)
    assert result['status'] == 'AUTO_PUBLISHED'
    assert result['curriculum']['modules'][0]['topics'] == ['Relations', 'Keys']


def test_empty_curriculum_stays_private(monkeypatch, tmp_path):
    extraction = {'complete': True, 'issues': [], 'reviewedPages': [0, 1], 'questionLabels': [], 'questions': [], 'modules': []}
    result, _, _ = run_pipeline(monkeypatch, tmp_path, 'CURRICULUM', extraction=extraction)
    assert result['status'] == 'RETRY_PENDING'
