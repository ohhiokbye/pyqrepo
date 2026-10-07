"""Extract one notes page at a time without downloading any model weights."""
import re
import pymupdf as fitz
from src.providers.cloud import ProviderFailure

MATERIAL_EXTRACTION_VERSION = 'notes-v1'

def extract_material_page(page, index, cloud):
    text = page.get_text('text', sort=True).strip()
    has_visuals = bool(page.get_images() or page.get_drawings())
    # Text-only born-digital pages take the inexpensive deterministic path.
    # Images/drawings can contain essential diagrams or equation glyphs.
    if not has_visuals and len(re.findall(r'\w', text)) >= 40 and '\ufffd' not in text:
        method = 'native'
        heading = next((line.strip()[:300] for line in text.splitlines() if line.strip()), '')
    elif not text and not has_visuals:
        method, heading = 'blank', ''
    else:
        if page.rect.width * page.rect.height > 10_000_000:
            raise ProviderFailure('PDF page dimensions exceed rendering budget')
        image = page.get_pixmap(matrix=fitz.Matrix(1.7, 1.7), alpha=False).tobytes('png')
        if len(image) > 12_000_000:
            raise ProviderFailure('Rendered notes page exceeds vision budget')
        result, method = cloud.transcribe_page(image)
        text, heading = result.text, result.heading
        if not text.strip():
            if has_visuals or page.get_text().strip():
                raise ProviderFailure('Vision returned no notes text for a nonblank page')
            method = 'blank'
    if len(text) > 100_000:
        raise ProviderFailure('Notes page text exceeds extraction budget')
    return {'pageIndex': index, 'text': text, 'heading': heading, 'method': method}
