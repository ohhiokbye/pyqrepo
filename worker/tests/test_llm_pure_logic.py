from src.providers.llm import _regex_segment_questions, _lexical_match_topic


def test_regex_segment_basic_questions():
    text = "Q1. Explain the OSI model. [10]\nQ2. Define TCP. [5]"
    questions = _regex_segment_questions(text)
    assert len(questions) == 2
    assert questions[0]['questionNumber'] == 'Q1'
    assert questions[0]['marks'] == 10
    assert questions[1]['questionNumber'] == 'Q2'
    assert questions[1]['marks'] == 5


def test_regex_segment_subquestions():
    text = "Q1(a) Explain X (5 Marks)\nQ1(b) Explain Y (5 Marks)"
    questions = _regex_segment_questions(text)
    assert len(questions) == 2
    assert questions[0]['questionNumber'] == 'Q1(a)'
    assert questions[1]['questionNumber'] == 'Q1(b)'


def test_regex_segment_falls_back_to_single_question_when_no_markers_found():
    text = "Just some plain exam text with no numbering at all."
    questions = _regex_segment_questions(text)
    assert len(questions) == 1
    assert questions[0]['questionNumber'] == 'Q1'
    assert questions[0]['extractedText'] == text.strip()


def test_regex_segment_splits_on_page_markers_when_no_question_numbers():
    text = "--- Question Paper Page 1 ---\nFirst page text\n--- Question Paper Page 2 ---\nSecond page text"
    questions = _regex_segment_questions(text)
    assert len(questions) == 2
    assert questions[0]['questionNumber'] == 'Q1'
    assert questions[1]['questionNumber'] == 'Q2'


def test_lexical_match_picks_best_overlapping_topic():
    question = "Explain the process of normalization in relational databases"
    topics = ["Normalization and Functional Dependencies", "Operating System Scheduling", "Computer Networks"]
    topic, confidence = _lexical_match_topic(question, topics)
    assert topic == "Normalization and Functional Dependencies"
    assert 0.0 <= confidence <= 1.0


def test_lexical_match_with_no_candidate_topics_returns_general():
    topic, confidence = _lexical_match_topic("Some question text", [])
    assert topic == "General"
    assert confidence == 0.85
