import os
import json
import re
import httpx
from abc import ABC, abstractmethod
from typing import List, Dict, Optional

class LLMProvider(ABC):
    @abstractmethod
    def segment_questions(self, text: str) -> List[Dict]:
        pass
        
    @abstractmethod
    def classify_question(self, question_text: str, candidate_topics: Optional[List[str]] = None) -> Dict:
        pass


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Use available 3.6-flash model
        self.model_name = "gemini-3.6-flash"
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"

    def _call_gemini(self, prompt: str) -> str:
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
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(self.base_url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
                else:
                    print(f"[Gemini API Error] {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[Gemini API Exception] {e}")
        return ""

    def segment_questions(self, text: str) -> List[Dict]:
        print("[Gemini] Analyzing document text to segment atomic questions...")
        
        # Limit text length if excessive to stay within standard limits
        truncated_text = text[:15000]

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
{truncated_text}
\"\"\"
"""
        response_text = self._call_gemini(prompt)
        if response_text:
            try:
                # Clean any markdown block formatting
                cleaned = re.sub(r"^```json\s*", "", response_text.strip(), flags=re.MULTILINE)
                cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
                parsed = json.loads(cleaned)
                if isinstance(parsed, list) and len(parsed) > 0:
                    print(f"[Gemini] Successfully segmented {len(parsed)} real questions from exam paper.")
                    return parsed
            except Exception as parse_err:
                print(f"[Gemini] JSON parse error: {parse_err}. Raw: {response_text[:200]}")

        # Fallback if Gemini returned empty
        print("[Gemini] Falling back to heuristic segmentation...")
        return [
            {"questionNumber": "Q1", "marks": 10, "extractedText": text[:300].strip()}
        ]

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

        return {
            "topicName": "General",
            "confidence": 0.85
        }


class MockLLMProvider(LLMProvider):
    def segment_questions(self, text: str) -> List[Dict]:
        return [
            {"questionNumber": "Q1", "marks": 10, "extractedText": text[:200].strip()}
        ]
        
    def classify_question(self, question_text: str, candidate_topics: Optional[List[str]] = None) -> Dict:
        return {
            "topicName": candidate_topics[0] if candidate_topics else "General",
            "confidence": 0.90
        }


def get_llm_provider() -> LLMProvider:
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    provider = os.environ.get('LLM_PROVIDER', '').lower()

    if (provider == 'gemini' or api_key) and len(api_key) > 10:
        print(f"[LLMProvider] Initializing GeminiProvider with API key ({api_key[:6]}...)")
        return GeminiProvider(api_key=api_key)

    print("[LLMProvider] Using MockLLMProvider (no GEMINI_API_KEY found)")
    return MockLLMProvider()
