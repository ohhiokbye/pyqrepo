import os
import json
import re
import time
import random
import httpx
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Ensure environment variables are loaded regardless of how worker was launched
_current_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.abspath(os.path.join(_current_dir, '..', '..', '..', '.env')))
load_dotenv(os.path.abspath(os.path.join(_current_dir, '..', '..', '.env')))


def _regex_segment_questions(text: str) -> List[Dict]:
    """
    Deterministic structural question segmenter:
    Scans the entire text for question and subquestion indicators.
    Never truncates text.
    """
    pattern = r'(?m)(?:^|\n)\s*(?:(Q(?:uestion)?\.?\s*\d+\s*(?:\([a-zA-Z0-9]+\))?)|(\d+\s*[\.\)]\s*(?:\([a-zA-Z0-9]+\))?))'
    matches = list(re.finditer(pattern, text))
    
    if not matches:
        # Check for page markers
        pages = re.split(r'--- Question Paper Page \d+ ---', text)
        clean_pages = [p.strip() for p in pages if p.strip()]
        if len(clean_pages) > 1:
            return [{'questionNumber': f'Q{i+1}', 'marks': 10, 'extractedText': p} for i, p in enumerate(clean_pages)]
        return [{'questionNumber': 'Q1', 'marks': 10, 'extractedText': text.strip()}]
    
    questions = []
    for i, m in enumerate(matches):
        raw_label = (m.group(1) or m.group(2) or f'Q{i+1}').strip()
        clean_label = re.sub(r'\s+', '', raw_label)
        if not clean_label.upper().startswith('Q'):
            clean_label = 'Q' + clean_label.rstrip('.')
        
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        q_text = text[start:end].strip()
        
        # Extract marks if present, e.g. [5], (5 Marks), 5 marks
        marks_match = re.search(r'\[\s*(\d+)\s*(?:marks?)?\s*\]|\(\s*(\d+)\s*marks?\s*\)|(\d+)\s*marks?', q_text, re.IGNORECASE)
        marks = 5
        if marks_match:
            val = marks_match.group(1) or marks_match.group(2) or marks_match.group(3)
            if val:
                try:
                    marks = int(val)
                except ValueError:
                    marks = 5
        
        questions.append({
            'questionNumber': clean_label,
            'marks': marks,
            'extractedText': q_text
        })
    return questions


class LLMProvider(ABC):
    @abstractmethod
    def segment_questions(self, text: str) -> List[Dict]:
        pass
        
    @abstractmethod
    def classify_question(self, question_text: str, candidate_topics: Optional[List[str]] = None) -> Dict:
        pass

    @abstractmethod
    def classify_questions_batch(self, questions: List[Dict], candidate_topics: Optional[List[str]] = None) -> List[Dict]:
        """Classify all questions in a single API call. Returns list of {questionNumber, topicName, confidence}."""
        pass


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model_name = "gemini-3.6-flash"
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"

    # Minimum pause between consecutive Gemini calls to avoid rate limits during bulk processing
    _last_call_time: float = 0.0
    _CALL_COOLDOWN: float = 1.5  # seconds

    def _call_gemini(self, prompt: str, max_retries: int = 5) -> str:
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }

        # Enforce cooldown between calls
        elapsed = time.time() - GeminiProvider._last_call_time
        if elapsed < self._CALL_COOLDOWN:
            time.sleep(self._CALL_COOLDOWN - elapsed)

        for attempt in range(max_retries):
            try:
                GeminiProvider._last_call_time = time.time()
                with httpx.Client(timeout=60.0) as client:
                    res = client.post(self.base_url, headers=headers, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                return parts[0].get("text", "")
                    elif res.status_code in (429, 503):
                        # Exponential backoff with jitter
                        base_wait = 2 * (2 ** attempt)  # 2, 4, 8, 16, 32
                        jitter = random.uniform(0, base_wait * 0.3)
                        wait = base_wait + jitter
                        # Respect Retry-After header if present
                        retry_after = res.headers.get('Retry-After')
                        if retry_after:
                            try:
                                wait = max(wait, float(retry_after))
                            except ValueError:
                                pass
                        print(f"[Gemini] {res.status_code} (attempt {attempt+1}/{max_retries}). Retrying in {wait:.1f}s...")
                        time.sleep(wait)
                        continue
                    else:
                        print(f"[Gemini API Error] {res.status_code}: {res.text[:200]}")
                        return ""
            except (httpx.ReadTimeout, httpx.ConnectTimeout):
                base_wait = 2 * (2 ** attempt)
                jitter = random.uniform(0, base_wait * 0.3)
                wait = base_wait + jitter
                print(f"[Gemini] Timeout (attempt {attempt+1}/{max_retries}). Retrying in {wait:.1f}s...")
                time.sleep(wait)
                continue
            except Exception as e:
                print(f"[Gemini API Exception] {e}")
                return ""

        print(f"[Gemini] All {max_retries} attempts exhausted. Falling back to default.")
        return ""

    def segment_questions(self, text: str) -> List[Dict]:
        print("[Gemini] Analyzing document text to segment atomic questions...")
        
        prompt = f"""
You are an expert academic exam analyzer.
Analyze the following raw OCR text of an exam question paper.
Segment the paper into discrete atomic questions and subquestions (for example: Q1(a), Q1(b), Q2(a), Q2(b), etc.).
For each question, extract:
- questionNumber: formatted string like "Q1(a)", "Q1(b)", "Q2"
- marks: numeric marks assigned to this subquestion (integer or float), or 5 if not indicated
- extractedText: the complete, clean text of this specific question or subquestion

Return ONLY a JSON array of objects with the following schema:
[
  {{
    "questionNumber": "Q1(a)",
    "marks": 5,
    "extractedText": "..."
  }}
]

Raw Exam Text:
\"\"\"
{text}
\"\"\"
"""
        response_text = self._call_gemini(prompt)
        if response_text:
            try:
                cleaned = re.sub(r"^```json\s*", "", response_text.strip(), flags=re.MULTILINE)
                cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
                parsed = json.loads(cleaned)
                if isinstance(parsed, list) and len(parsed) > 0:
                    print(f"[Gemini] Successfully segmented {len(parsed)} real questions from exam paper.")
                    return parsed
            except Exception as parse_err:
                print(f"[Gemini] JSON parse error: {parse_err}. Raw: {response_text[:200]}")

        # Fallback to deterministic regex segmentation across full text
        print("[Gemini] Falling back to structural regex segmentation...")
        return _regex_segment_questions(text)

    def classify_question(self, question_text: str, candidate_topics: Optional[List[str]] = None) -> Dict:
        topics_str = ", ".join(candidate_topics) if candidate_topics else "General Course Syllabus Topics"
        
        prompt = f"""
You are an academic course topic classifier.
Given the following exam question and candidate syllabus topics:
Question: "{question_text}"
Candidate Topics: [{topics_str}]

Classify which syllabus topic this question most accurately addresses.
Assign a confidence score between 0.00 and 1.00 indicating your certainty.

Return ONLY a JSON object:
{{
  "topicName": "Exact matching topic name",
  "confidence": 0.95
}}
"""
        response_text = self._call_gemini(prompt)
        if response_text:
            try:
                cleaned = re.sub(r"^```json\s*", "", response_text.strip(), flags=re.MULTILINE)
                cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
                parsed = json.loads(cleaned)
                if isinstance(parsed, dict) and "topicName" in parsed:
                    return {
                        "topicName": parsed.get("topicName", "General"),
                        "confidence": float(parsed.get("confidence", 0.88))
                    }
            except Exception as e:
                print(f"[Gemini] Classification parse error: {e}")

        matched_topic, conf = _semantic_match_topic(question_text, candidate_topics or [])
        return {
            "topicName": matched_topic,
            "confidence": conf
        }

    def classify_questions_batch(self, questions: List[Dict], candidate_topics: Optional[List[str]] = None) -> List[Dict]:
        """Classify ALL questions in a single Gemini call. Reduces N API calls to 1 per paper."""
        topics_str = ", ".join(candidate_topics) if candidate_topics else "General Course Syllabus Topics"

        questions_block = ""
        for q in questions:
            q_num = q.get('questionNumber', 'Q')
            q_text = q.get('extractedText', '')[:300]  # Truncate per-question for prompt size
            questions_block += f"- {q_num}: {q_text}\n"

        prompt = f"""
You are an academic course topic classifier.
Given the following exam questions and candidate syllabus topics, classify EACH question to its best matching topic.

Candidate Topics: [{topics_str}]

Questions:
{questions_block}

For each question, return its question number, the best matching topic name (must be from the candidate list), and a confidence score (0.00-1.00).

Return ONLY a JSON array:
[
  {{
    "questionNumber": "Q1",
    "topicName": "Exact matching topic name",
    "confidence": 0.95
  }}
]
"""
        print(f"[Gemini] Batch-classifying {len(questions)} questions in a single API call...")
        response_text = self._call_gemini(prompt)
        if response_text:
            try:
                cleaned = re.sub(r"^```json\s*", "", response_text.strip(), flags=re.MULTILINE)
                cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
                parsed = json.loads(cleaned)
                if isinstance(parsed, list) and len(parsed) > 0:
                    print(f"[Gemini] Batch classification returned {len(parsed)} results.")
                    return parsed
            except Exception as e:
                print(f"[Gemini] Batch classification parse error: {e}")

        # Fallback: classify one-by-one using local semantic matcher
        print("[Gemini] Batch classification failed. Falling back to local semantic matching...")
        results = []
        for q in questions:
            matched_topic, conf = _semantic_match_topic(q.get('extractedText', ''), candidate_topics or [])
            results.append({
                'questionNumber': q.get('questionNumber', 'Q'),
                'topicName': matched_topic,
                'confidence': conf
            })
        return results


def _semantic_match_topic(question_text: str, candidate_topics: List[str]) -> tuple[str, float]:
    """
    Local semantic vector & keyword overlap matcher:
    Computes cosine similarity between question tokens and candidate syllabus topics.
    Zero external API dependency.
    """
    if not candidate_topics:
        return "General", 0.85
    import math
    from collections import Counter
    q_words = Counter(re.findall(r'\w{3,}', question_text.lower()))
    best_topic = candidate_topics[0]
    best_score = -1.0
    for topic in candidate_topics:
        t_words = Counter(re.findall(r'\w{3,}', topic.lower()))
        intersection = set(q_words.keys()) & set(t_words.keys())
        if not intersection:
            score = 0.05
        else:
            dot = sum(q_words[k] * t_words[k] for k in intersection)
            mag_q = math.sqrt(sum(v**2 for v in q_words.values()))
            mag_t = math.sqrt(sum(v**2 for v in t_words.values()))
            score = dot / (mag_q * mag_t) if (mag_q * mag_t) > 0 else 0.0
        if score > best_score:
            best_score = score
            best_topic = topic
    confidence = round(min(0.98, max(0.75, 0.70 + best_score * 0.6)), 2)
    return best_topic, confidence


class MockLLMProvider(LLMProvider):
    def segment_questions(self, text: str) -> List[Dict]:
        return _regex_segment_questions(text)
        
    def classify_question(self, question_text: str, candidate_topics: Optional[List[str]] = None) -> Dict:
        matched_topic, conf = _semantic_match_topic(question_text, candidate_topics or [])
        return {
            "topicName": matched_topic,
            "confidence": conf
        }

    def classify_questions_batch(self, questions: List[Dict], candidate_topics: Optional[List[str]] = None) -> List[Dict]:
        results = []
        for q in questions:
            matched_topic, conf = _semantic_match_topic(q.get('extractedText', ''), candidate_topics or [])
            results.append({
                'questionNumber': q.get('questionNumber', 'Q'),
                'topicName': matched_topic,
                'confidence': conf
            })
        return results


def get_llm_provider() -> LLMProvider:
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    provider = os.environ.get('LLM_PROVIDER', '').lower()

    if (provider == 'gemini' or api_key) and len(api_key) > 10:
        print(f"[LLMProvider] Initializing GeminiProvider with API key ({api_key[:6]}...)")
        return GeminiProvider(api_key=api_key)

    print("[LLMProvider] Using MockLLMProvider (no GEMINI_API_KEY found)")
    return MockLLMProvider()
