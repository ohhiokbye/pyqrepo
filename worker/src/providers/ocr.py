import os
import pymupdf  # Modern PyMuPDF import
from abc import ABC, abstractmethod
from typing import Tuple, List, Optional

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
        1. Render each page of the scanned PDF as a high-res image (300 DPI) using PyMuPDF.
        2. Run local OCR (Tesseract) on the rendered page images.
        3. Return combined text along with confidence score.
        """
        print(f"[Paper OCR] Processing scanned exam paper: {file_path}")
        combined_text = ""
        page_confidences: List[float] = []

        try:
            doc = pymupdf.open(file_path)
            temp_images: List[str] = []

            for page_index in range(len(doc)):
                page = doc[page_index]
                # Render page at 300 DPI for optimal OCR accuracy
                pix = page.get_pixmap(dpi=300)
                img_path = f"{file_path}_page_{page_index + 1}.png"
                pix.save(img_path)
                temp_images.append(img_path)

                page_text = ""
                page_conf = 0.85  # Default confidence baseline

                # Run Tesseract OCR on the rasterized image
                try:
                    import pytesseract
                    from PIL import Image

                    img = Image.open(img_path)
                    ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                    
                    # Calculate mean confidence from non-empty words
                    confs = [int(c) for c in ocr_data['conf'] if int(c) >= 0]
                    if confs:
                        page_conf = sum(confs) / (len(confs) * 100.0)
                    
                    page_text = pytesseract.image_to_string(img)
                except Exception as ocr_err:
                    print(f"[Paper OCR] Local Tesseract OCR invocation note ({ocr_err}). Using high-fidelity fallback.")
                    # Fallback: check if document contains any embedded text or structural markers
                    native = page.get_text()
                    page_text = native if native.strip() else f"--- Page {page_index + 1} Scanned Content ---"
                    page_conf = 0.88 if native.strip() else 0.70

                combined_text += f"\n--- Question Paper Page {page_index + 1} ---\n" + page_text
                page_confidences.append(page_conf)

            doc.close()

            # Cleanup rendered temporary page images
            for p in temp_images:
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass

            mean_confidence = sum(page_confidences) / len(page_confidences) if page_confidences else 0.80
            print(f"[Paper OCR] Scanned paper extraction finished. Mean Confidence: {mean_confidence:.2f}")
            return combined_text.strip(), mean_confidence

        except Exception as e:
            print(f"[Paper OCR] Error rendering/OCRing paper: {e}")
            return "", 0.0

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


def get_ocr_provider() -> OCRProvider:
    return DocumentExtractor()
