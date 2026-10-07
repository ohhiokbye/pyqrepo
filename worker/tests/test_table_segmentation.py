import pymupdf
import pytest
from src.pipeline.materials import extract_material_page
from src.providers.cloud import CloudExtractor, PageTranscription, ProviderFailure, DocumentExtraction


def test_visual_notes_use_vision_and_preserve_formula_table_and_code():
    class Page:
        rect = pymupdf.Rect(0, 0, 600, 900)
        def get_text(self, *args, **kwargs): return 'An incomplete equation'
        def get_images(self): return [1]
        def get_drawings(self): return []
        def get_pixmap(self, **kwargs): return type('Pixmap', (), {'tobytes': lambda self, kind: b'page-image'})()
    class Cloud:
        def transcribe_page(self, image):
            assert image == b'page-image'
            return PageTranscription(text='E = mc^2\n\n| x | y |\n| 2 | 4 |\n\nprint(x)', heading='Energy', complete=True, issues=[]), 'gemini-vision'
    result = extract_material_page(Page(), 3, Cloud())
    assert result['pageIndex'] == 3
    assert 'E = mc^2' in result['text'] and 'print(x)' in result['text']
    assert result['method'] == 'gemini-vision'


def test_unreadable_page_is_not_accepted_as_a_checkpoint(monkeypatch):
    cloud = CloudExtractor()
    monkeypatch.setattr(cloud, 'gemini', lambda *args, **kwargs: PageTranscription(text='?', complete=False, issues=['unreadable']))
    with pytest.raises(ProviderFailure):
        cloud.transcribe_page(b'image')


def test_truncated_cloud_output_is_rejected(monkeypatch):
    cloud = CloudExtractor()
    cloud.gemini_key = 'fixture-key'
    monkeypatch.setattr(cloud, '_request', lambda *args: {'candidates': [{'finishReason': 'MAX_TOKENS'}]})
    with pytest.raises(ProviderFailure, match='stopped'):
        cloud.gemini('extract', DocumentExtraction)
