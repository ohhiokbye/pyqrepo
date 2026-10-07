"""Provider-neutral OCR records. Polygons refer to the stored, corrected page image."""
import os
from abc import ABC, abstractmethod
from typing import Tuple, List
import pymupdf
from PIL import Image, ImageOps


def _is_digital_page(page):
    if len(''.join(page.get_text().split())) < 100:
        return False
    area = page.rect.width * page.rect.height
    return not any(pymupdf.Rect(item['bbox']).get_area() > area * .5 for item in page.get_image_info())


def _text_from_ocr_data(data):
    lines = {}
    for i, word in enumerate(data['text']):
        if word.strip():
            key = tuple(data[field][i] for field in ('block_num', 'par_num', 'line_num'))
            lines.setdefault(key, []).append(word)
    return '\n'.join(' '.join(words) for words in lines.values())


class OCRProvider(ABC):
    provider_name = 'unknown'

    def __init__(self):
        self._pages = []

    @abstractmethod
    def extract_paper_text(self, file_path: str) -> Tuple[str, float]:
        pass

    def extract_material_text(self, file_path: str) -> Tuple[str, float]:
        # Mixed digital/scanned curricula use the same per-page fallback.
        return self.extract_paper_text(file_path)

    def page_layouts(self) -> List[List[dict]]:
        return [page['lines'] for page in self._pages]

    def page_records(self) -> List[dict]:
        return [{key: value for key, value in page.items() if key != 'imagePath'} for page in self._pages]

    def page_image(self, index):
        return self._pages[index]['imagePath']

    @staticmethod
    def native_lines(page, scale):
        lines = []
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                text = ''.join(span['text'] for span in line['spans']).strip()
                if text:
                    x0, y0, x1, y1 = [v * scale for v in line['bbox']]
                    lines.append({'text': text, 'confidence': 1.0, 'polygon': [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]})
        return lines

    def recognise(self, image):
        import pytesseract
        data = pytesseract.image_to_data(ImageOps.autocontrast(ImageOps.grayscale(image)), output_type=pytesseract.Output.DICT)
        groups = {}
        for i, word in enumerate(data['text']):
            if not word.strip() or float(data['conf'][i]) < 0:
                continue
            key = tuple(data[field][i] for field in ('block_num', 'par_num', 'line_num'))
            groups.setdefault(key, []).append(i)
        lines = []
        for indices in groups.values():
            x0 = min(data['left'][i] for i in indices)
            y0 = min(data['top'][i] for i in indices)
            x1 = max(data['left'][i] + data['width'][i] for i in indices)
            y1 = max(data['top'][i] + data['height'][i] for i in indices)
            lines.append({'text': ' '.join(data['text'][i] for i in indices), 'confidence': sum(float(data['conf'][i]) for i in indices)/len(indices)/100, 'polygon': [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]})
        return image, lines, 'tesseract'

    def extract_pages(self, file_path):
        self._pages = []
        with pymupdf.open(file_path) as doc:
            if not 1 <= len(doc) <= int(os.environ.get('MAX_DOCUMENT_PAGES', '100')):
                raise ValueError('Document page count exceeds worker limit')
            for index, page in enumerate(doc):
                area = page.rect.get_area()
                scale = min(3., (12_000_000/max(area, 1)) ** .5)
                pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csRGB, alpha=False)
                image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
                provider = 'native'
                if _is_digital_page(page):
                    lines = self.native_lines(page, scale)
                else:
                    try:
                        image, lines, provider = self.recognise(image)
                    except Exception as error:
                        print(f'[OCR] Page {index + 1} failed ({type(error).__name__})')
                        lines, provider = [], self.provider_name
                image_path = f'{file_path}.page-{index}.png'
                image.save(image_path)
                confidence = sum(line['confidence'] for line in lines)/len(lines) if lines else 0.
                self._pages.append({'pageIndex': index, 'width': image.width, 'height': image.height, 'coordinateSpace': 'corrected-image-pixels', 'provider': provider, 'confidence': confidence, 'lines': lines, 'imagePath': image_path})
        text = '\n'.join(f"--- Question Paper Page {page['pageIndex'] + 1} ---\n" + '\n'.join(line['text'] for line in page['lines']) for page in self._pages if page['lines'])
        confidence = sum(page['confidence'] for page in self._pages)/len(self._pages) if self._pages else 0.
        return text, confidence


class DocumentExtractor(OCRProvider):
    provider_name = 'tesseract'

    def extract_paper_text(self, file_path):
        return self.extract_pages(file_path)


class PaddleOCRProvider(DocumentExtractor):
    provider_name = 'paddleocr'

    def __init__(self):
        super().__init__()
        self._ocr = None
        self._unavailable = False
        self._use_unwarping = True

    def table_fallback(self):
        # Reuse the loaded model; orientation still runs, but preserve page edges
        # when UVDoc warping removes a table's number/marks columns.
        fallback = PaddleOCRProvider()
        fallback._ocr = self._ocr
        fallback._use_unwarping = False
        return fallback

    def _load(self):
        if self._unavailable:
            return False
        if self._ocr is None:
            try:
                os.environ.setdefault('FLAGS_allocator_strategy', 'auto_growth')
                from paddleocr import PaddleOCR
                self._ocr = PaddleOCR(lang='en', device=os.environ.get('OCR_DEVICE', 'gpu:0'), text_detection_model_name='PP-OCRv5_mobile_det', text_recognition_model_name='en_PP-OCRv5_mobile_rec', use_doc_orientation_classify=True, use_doc_unwarping=True, use_textline_orientation=True)
            except Exception as error:
                self._unavailable = True
                print(f'[PaddleOCR] Runtime unavailable ({type(error).__name__}); falling back to Tesseract.')
        return self._ocr is not None

    @staticmethod
    def _normalise_result(result):
        data = result.json if hasattr(result, 'json') else result
        if callable(data):
            data = data()
        if isinstance(data, dict):
            data = data.get('res', data)
        lines = []
        if isinstance(data, dict):
            polys = data.get('rec_polys', [])
            scores = data.get('rec_scores', [])
            for i, text in enumerate(data.get('rec_texts', [])):
                if str(text).strip():
                    poly = polys[i].tolist() if hasattr(polys[i], 'tolist') else polys[i]
                    lines.append({'text': str(text), 'confidence': float(scores[i]), 'polygon': poly})
        elif isinstance(data, list):
            for polygon, (text, score) in data:
                lines.append({'text': str(text), 'confidence': float(score), 'polygon': polygon})
        return '\n'.join(line['text'] for line in lines), sum(line['confidence'] for line in lines)/len(lines) if lines else 0., lines

    def recognise(self, image):
        if not self._load():
            return super().recognise(image)
        import numpy as np
        try:
            result = next(iter(self._ocr.predict(np.asarray(image)[:, :, ::-1].copy(), use_doc_unwarping=self._use_unwarping)))
            _, _, lines = self._normalise_result(result)
            # Polygons are on the preprocessed image, not the original PDF render.
            corrected = result['doc_preprocessor_res'].get('output_img')
            if corrected is None:
                raise ValueError('Missing corrected image; coordinate alignment cannot be verified')
            return Image.fromarray(corrected[:, :, ::-1].astype('uint8')), lines, 'paddleocr' if self._use_unwarping else 'paddleocr-no-unwarp'
        except Exception as error:
            print(f'[PaddleOCR] Recognition failed ({type(error).__name__}); falling back to Tesseract.')
            return super().recognise(image)


TesseractOCRProvider = DocumentExtractor

def get_ocr_provider():
    provider = os.environ.get('OCR_PROVIDER', 'paddle').lower().strip()
    if provider in ('paddle', 'paddleocr'):
        return PaddleOCRProvider()
    if provider == 'tesseract':
        return DocumentExtractor()
    raise ValueError(f'Unsupported OCR provider: {provider}')
