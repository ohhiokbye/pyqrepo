from abc import ABC, abstractmethod
from typing import List, Dict
import os

class LLMProvider(ABC):
    @abstractmethod
    def segment_questions(self, text: str) -> List[Dict]:
        pass
        
    @abstractmethod
    def classify_question(self, question_text: str) -> Dict:
        pass

class MockLLMProvider(LLMProvider):
    def segment_questions(self, text: str) -> List[Dict]:
        print("Mock LLM: Segmenting questions deterministically...")
        return [
            {"questionNumber": "Q1(a)", "marks": 5, "extractedText": "Explain the ER Model."},
            {"questionNumber": "Q1(b)", "marks": 10, "extractedText": "Convert the ER diagram to relational tables."}
        ]
        
    def classify_question(self, question_text: str) -> Dict:
        print(f"Mock LLM: Classifying question: '{question_text}'")
        # Returns a mock topic classification that matches our seed script
        return {
            "topicName": "ER Model",
            "confidence": 0.95
        }

class GeminiProvider(LLMProvider):
    def segment_questions(self, text: str) -> List[Dict]:
        raise NotImplementedError("Gemini provider not implemented yet.")
        
    def classify_question(self, question_text: str) -> Dict:
        raise NotImplementedError("Gemini provider not implemented yet.")

def get_llm_provider() -> LLMProvider:
    provider = os.environ.get('LLM_PROVIDER', 'mock')
    if provider == 'gemini':
        return GeminiProvider()
    return MockLLMProvider()
