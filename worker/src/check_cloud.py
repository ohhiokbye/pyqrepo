"""Explicit setup probes using owner keys; prints status, never secrets."""
import os
from pathlib import Path
from dotenv import load_dotenv
import pymupdf
import httpx
from pydantic import BaseModel
from providers.cloud import CloudExtractor, ProviderFailure

load_dotenv(Path(__file__).resolve().parents[1] / '.env')
load_dotenv(Path(__file__).resolve().parents[2] / '.env')

class Probe(BaseModel):
    text: str


def main():
    cloud = CloudExtractor()
    failures = 0
    with pymupdf.open() as pdf:
        page = pdf.new_page(width=500, height=200)
        page.insert_text((30, 60), 'CPYQ provider setup check. Question 1: Explain a primary key. [5 marks]')
        sample_pdf = pdf.tobytes()
        sample_image = page.get_pixmap().tobytes('png')
    for provider in ['Gemini', 'Groq vision']:
        key = cloud.gemini_key if provider == 'Gemini' else cloud.groq_key
        if not key:
            print(f'{provider}: missing owner key', flush=True)
            failures += 1
            continue
        try:
            with httpx.Client(timeout=30) as client:
                if provider == 'Gemini':
                    response = client.get(f'https://generativelanguage.googleapis.com/v1beta/models/{cloud.gemini_model}', headers={'x-goog-api-key': key})
                    if not response.is_success or 'generateContent' not in response.json().get('supportedGenerationMethods', []):
                        raise ProviderFailure(f'model access HTTP {response.status_code}')
                    result = cloud.gemini('Read the attached PDF and return JSON with text containing the question and its printed marks.', Probe, sample_pdf)
                    text = result.text
                else:
                    response = client.get('https://api.groq.com/openai/v1/models', headers={'Authorization': f'Bearer {key}'})
                    if not response.is_success or cloud.vision_model not in {model['id'] for model in response.json().get('data', [])}:
                        raise ProviderFailure(f'vision model not accessible (HTTP {response.status_code})')
                    text = cloud.groq('Read this image and return JSON {"text": "question text and printed marks"}.', sample_image).get('text', '')
            if 'primary key' not in text.lower() or '5' not in text:
                raise ProviderFailure('document probe did not recover the question and printed marks')
            print(f'{provider}: model access, document capability and current generation quota passed', flush=True)
        except Exception as error:
            category = str(error) if isinstance(error, ProviderFailure) else type(error).__name__
            print(f'{provider}: {category}', flush=True)
            failures += 1
    return 1 if failures else 0

if __name__ == '__main__':
    raise SystemExit(main())
