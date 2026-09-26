import json

import httpx
import pytest

from src.providers import llm

GEMINI_QUOTA_ERROR = httpx.Response(429, json={"error": {"message": "You exceeded your current quota"}})
PAPER_TEXT = "Q1. Explain BCNF with an example. [10]\nQ2. Define functional dependency. [5]"


def fallback_reply(content):
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content)}}]})


@pytest.fixture
def no_sleep(monkeypatch):
    monkeypatch.setattr(llm.time, "sleep", lambda seconds: None)


@pytest.fixture
def fallback_configured(monkeypatch):
    monkeypatch.setenv("LLM_FALLBACK_BASE_URL", "https://fallback.test/v1")
    monkeypatch.setenv("LLM_FALLBACK_API_KEY", "test-key")
    monkeypatch.setenv("LLM_FALLBACK_MODEL", "test-model")


def route_posts(monkeypatch, fallback_response):
    """Gemini always answers 429; the fallback endpoint answers with `fallback_response`."""
    calls = []

    def fake_post(self, url, *args, **kwargs):
        calls.append(url)
        return fallback_response if "fallback.test" in url else GEMINI_QUOTA_ERROR

    monkeypatch.setattr(httpx.Client, "post", fake_post)
    return calls


def test_gemini_quota_error_switches_to_fallback_immediately(monkeypatch, no_sleep, fallback_configured):
    segmented = [
        {"questionNumber": "Q1", "marks": 10, "extractedText": "Explain BCNF with an example."},
        {"questionNumber": "Q2", "marks": 5, "extractedText": "Define functional dependency."},
    ]
    calls = route_posts(monkeypatch, fallback_reply(segmented))

    questions = llm.GeminiProvider("x" * 20).segment_questions(PAPER_TEXT)

    assert questions == segmented
    # One Gemini attempt, then straight to the fallback - no 5x backoff on a quota error
    assert len(calls) == 2
    assert calls[1] == "https://fallback.test/v1/chat/completions"


def test_without_fallback_configured_behaviour_is_unchanged(monkeypatch, no_sleep):
    monkeypatch.delenv("LLM_FALLBACK_BASE_URL", raising=False)
    monkeypatch.delenv("LLM_FALLBACK_API_KEY", raising=False)
    calls = route_posts(monkeypatch, fallback_reply([]))

    questions = llm.GeminiProvider("x" * 20).segment_questions(PAPER_TEXT)

    assert questions == llm._regex_segment_questions(PAPER_TEXT)
    assert all("fallback.test" not in url for url in calls)


def test_topic_name_outside_syllabus_is_replaced_by_local_match(monkeypatch, no_sleep, fallback_configured):
    topics = ["Normalization: 1NF, 2NF, 3NF, BCNF", "Transaction states"]
    route_posts(monkeypatch, fallback_reply([
        {"questionNumber": "Q1", "topicName": "Database Normalisation", "confidence": 0.9},  # invented name
        {"questionNumber": "Q2", "topicName": "Transaction states", "confidence": 0.9},
    ]))
    questions = [
        {"questionNumber": "Q1", "extractedText": "Normalize the relation up to BCNF."},
        {"questionNumber": "Q2", "extractedText": "Draw the transaction states diagram."},
    ]

    results = llm.GeminiProvider("x" * 20).classify_questions_batch(questions, topics)

    assert [r["topicName"] for r in results] == topics
    assert results[1]["confidence"] == 0.9  # valid answers are kept as-is
