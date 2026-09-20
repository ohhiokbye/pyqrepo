import os
import pymupdf  # Modern PyMuPDF import
from abc import ABC, abstractmethod
from typing import Tuple, List, Optional

from PIL import Image, ImageOps, ImageEnhance
# Prevent Pillow DecompressionBombError on large scanned pages
Image.MAX_IMAGE_PIXELS = None


class OCRProvider(ABC):
    @abstractmethod
    def extract_paper_text(self, file_path: str) -> Tuple[str, float]:
        """Extract text from scanned question papers via page rendering and OCR."""
        pass

    @abstractmethod
    def extract_material_text(self, file_path: str) -> Tuple[str, float]:
        """Extract text from digital notes/PPTs natively with OCR fallback."""
        pass


class DocumentExtractor(OCRProvider):
    def extract_paper_text(self, file_path: str) -> Tuple[str, float]:
        """
        Scanned Paper Pipeline:
        1. Render each page using adaptive matrix scaling to prevent memory/decompression explosion.
        2. Preprocess rendered page image (grayscale, autocontrast, sharpening).
        3. Run OCR on preprocessed image and aggregate page results.
        """
        print(f"[Paper OCR] Processing scanned exam paper: {file_path}")
        combined_text = ""
        page_confidences: List[float] = []
        temp_images: List[str] = []

        try:
            doc = pymupdf.open(file_path)

            for page_index in range(len(doc)):
                page = doc[page_index]
                rect = page.rect
                area = rect.width * rect.height
                
                # Dynamic adaptive scale: target ~12 megapixels max, scale <= 3.0
                scale = min(3.0, (12_000_000 / area) ** 0.5 if area > 0 else 2.0)
                pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale))
                
                img_path = f"{file_path}_page_{page_index + 1}.png"
                pix.save(img_path)
                temp_images.append(img_path)

                page_text = ""
                page_conf = 0.85

                try:
                    import pytesseract

                    # Preprocess for contrast and legibility
                    with Image.open(img_path) as raw_img:
                        gray = ImageOps.grayscale(raw_img)
                        enhanced = ImageOps.autocontrast(gray, cutoff=2)
                        preprocessed = ImageEnhance.Contrast(enhanced).enhance(1.4)
                        preprocessed.save(img_path)

                    with Image.open(img_path) as img:
                        ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                        confs = [int(c) for c in ocr_data['conf'] if int(c) >= 0]
                        if confs:
                            page_conf = sum(confs) / (len(confs) * 100.0)
                        page_text = pytesseract.image_to_string(img)
                except Exception as ocr_err:
                    print(f"[Paper OCR] Local Tesseract OCR invocation note on page {page_index + 1}: {ocr_err}")
                    native = page.get_text()
                    if native.strip():
                        page_text = native
                        page_conf = 0.88
                    else:
                        page_text = ""
                        page_conf = 0.20

                if page_text.strip():
                    combined_text += f"\n--- Question Paper Page {page_index + 1} ---\n" + page_text
                    page_confidences.append(page_conf)
                else:
                    print(f"[Paper OCR] Warning: Page {page_index + 1} produced no legible text.")
                    page_confidences.append(0.20)

            doc.close()

            mean_confidence = sum(page_confidences) / len(page_confidences) if page_confidences else 0.50
            print(f"[Paper OCR] Extraction finished. Total text chars: {len(combined_text)}, Mean Conf: {mean_confidence:.2f}")
            return combined_text.strip(), mean_confidence

        except Exception as e:
            print(f"[Paper OCR] Critical error rendering/OCRing paper: {e}")
            return "", 0.0
        finally:
            for p in temp_images:
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass

    def extract_material_text(self, file_path: str) -> Tuple[str, float]:
        """
        Study Material Pipeline:
        1. Attempt clean deterministic native text extraction first via PyMuPDF.
        2. Fallback to OCR only if text length is negligible (e.g. scanned slides).
        """
        print(f"[Material Extractor] Extracting study notes/material: {file_path}")
        text = ""
        try:
            doc = pymupdf.open(file_path)
            for page_index in range(len(doc)):
                page_text = doc[page_index].get_text()
                if page_text.strip():
                    text += f"\n--- Slide/Page {page_index + 1} ---\n" + page_text
            doc.close()

            if len(text.strip()) > 50:
                print(f"[Material Extractor] Extracted {len(text.strip())} chars natively via PyMuPDF.")
                return text.strip(), 0.98

        except Exception as e:
            print(f"[Material Extractor] Native extraction error: {e}")

        # Fallback to scanned paper OCR if material was image-based
        print("[Material Extractor] Notes are image-based. Falling back to OCR...")
        return self.extract_paper_text(file_path)


class GLMOCRProvider(OCRProvider):
    """
    Multimodal Vision-Language OCR using Hugging Face's zai-org/GLM-OCR.
    Capable of running locally on GPU with automatic fallback to DocumentExtractor.
    """
    def __init__(self, model_id: str = "zai-org/GLM-OCR"):
        self.model_id = model_id
        self._processor = None
        self._model = None
        self._fallback = DocumentExtractor()

    def _load_model(self) -> bool:
        if self._model is not None:
            return True
        try:
            import torch
            from transformers import AutoProcessor, GlmOcrForConditionalGeneration

            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"[GLM-OCR] Initializing {self.model_id} on {device.upper()} (CUDA: {torch.cuda.is_available()})...")
            self._processor = AutoProcessor.from_pretrained(self.model_id)
            self._model = GlmOcrForConditionalGeneration.from_pretrained(
                self.model_id,
                dtype=torch.bfloat16 if device == "cuda" else torch.float32,
                device_map="auto" if device == "cuda" else None
            )
            self._model.eval()
            print(f"[GLM-OCR] Successfully loaded {self.model_id} on {device.upper()}!")
            return True
        except Exception as err:
            print(f"[GLM-OCR] Note: Model initialization deferred/skipped ({err}). Using robust DocumentExtractor fallback.")
            return False

    def extract_paper_text(self, file_path: str) -> Tuple[str, float]:
        if not self._load_model():
            return self._fallback.extract_paper_text(file_path)

        print(f"[GLM-OCR] Transcribing exam paper via GPU: {file_path}")
        combined_text = ""
        temp_images: List[str] = []
        try:
            import torch
            from PIL import Image

            doc = pymupdf.open(file_path)
            for page_index in range(len(doc)):
                page = doc[page_index]
                rect = page.rect
                area = rect.width * rect.height
                scale = min(3.0, (12_000_000 / area) ** 0.5 if area > 0 else 2.0)
                pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale))
                img_path = f"{file_path}_glm_p{page_index + 1}.png"
                pix.save(img_path)
                temp_images.append(img_path)

                with Image.open(img_path) as raw_img:
                    rgb_img = raw_img.convert("RGB")
                    messages = [
                        {
                            "role": "user",
                            "content": [
                                {"type": "image", "image": rgb_img},
                                {"type": "text", "text": "Transcribe the examination paper into structured Markdown format, accurately outputting question numbers, subquestions, marks, formulas, and tables."}
                            ]
                        }
                    ]
                    inputs = self._processor.apply_chat_template(
                        messages,
                        add_generation_prompt=True,
                        tokenize=True,
                        return_dict=True,
                        return_tensors="pt"
                    ).to(self._model.device)

                    with torch.no_grad():
                        outputs = self._model.generate(**inputs, max_new_tokens=2048)
                        page_text = self._processor.decode(outputs[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)

                if page_text.strip():
                    combined_text += f"\n--- Question Paper Page {page_index + 1} ---\n" + page_text

            doc.close()
            return combined_text.strip(), 0.95
        except Exception as e:
            print(f"[GLM-OCR] Execution error ({e}). Delegating to DocumentExtractor fallback.")
            return self._fallback.extract_paper_text(file_path)
        finally:
            for p in temp_images:
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass

    def extract_material_text(self, file_path: str) -> Tuple[str, float]:
        return self._fallback.extract_material_text(file_path)


TesseractOCRProvider = DocumentExtractor

def get_ocr_provider() -> OCRProvider:
    provider_name = os.environ.get('OCR_PROVIDER', 'tesseract').lower().strip()
    if provider_name in ('glm-ocr', 'glm', 'huggingface'):
        return GLMOCRProvider()
    return DocumentExtractor()
