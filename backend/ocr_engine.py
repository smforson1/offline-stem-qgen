# Owner: S1 | Purpose: PaddleOCR wrapper — extracts text from images captured by the mobile app

import os
import logging
from typing import Dict, List, Any, Union
import numpy as np
from PIL import Image

# Configure local logging
logger = logging.getLogger(__name__)

class OcrEngine:
    """
    A wrapper around PaddleOCR/PaddleX to handle text extraction from images.
    Initializes models lazily (singleton-like pattern per instance or globally)
    to save memory and startup time.
    """
    _ocr_instance = None
    _ocr_instance_key = None

    def __init__(self, lang: str = 'en', device: str = 'cpu', enable_mkldnn: bool = False):
        self.lang = lang
        self.device = device
        self.enable_mkldnn = enable_mkldnn
        self._model = None

    def _get_model(self):
        """
        Lazy-loads the PaddleOCR model instance.
        """
        if self._model is not None:
            return self._model

        # Check if we have a shared global instance with the same config
        # to prevent reloading models multiple times
        cache_key = (self.lang, self.device, self.enable_mkldnn)
        if OcrEngine._ocr_instance is not None and OcrEngine._ocr_instance_key == cache_key:
            self._model = OcrEngine._ocr_instance
            return self._model

        logger.info(f"Initializing PaddleOCR with lang={self.lang}, device={self.device}, enable_mkldnn={self.enable_mkldnn}...")
        try:
            # Import dynamically to avoid loading times if not used
            from paddleocr import PaddleOCR
            # Initialize PaddleOCR
            model = PaddleOCR(
                lang=self.lang,
                device=self.device,
                enable_mkldnn=self.enable_mkldnn,
                use_textline_orientation=True
            )
            self._model = model
            # Cache globally
            OcrEngine._ocr_instance = model
            OcrEngine._ocr_instance_key = cache_key
            logger.info("PaddleOCR model initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {str(e)}")
            raise RuntimeError(f"OCR Engine initialization failed: {str(e)}") from e

        return self._model

    def extract_text_from_image(self, image_input: Union[str, np.ndarray, Image.Image]) -> Dict[str, Any]:
        """
        Extracts text from an image.
        
        Args:
            image_input: Can be a path to an image file (str), a numpy array (np.ndarray), 
                         or a PIL Image object.
                         
        Returns:
            A dictionary containing:
            - 'full_text': A single string with all extracted text lines joined by newlines.
            - 'lines': A list of dictionaries for each text segment with keys:
                - 'text': The recognized text.
                - 'box': List of 4 points [[x, y], ...] representing the bounding box.
                - 'confidence': Confidence score of recognition (0.0 to 1.0).
        """
        # 1. Resolve and validate input
        processed_input = image_input
        if isinstance(image_input, str):
            if not os.path.exists(image_input):
                raise FileNotFoundError(f"Image file not found: {image_input}")
            # Ensure it is a valid image file by trying to open it
            try:
                with Image.open(image_input) as img:
                    img.verify()
            except Exception as e:
                raise ValueError(f"Invalid image file at {image_input}: {str(e)}")
        elif isinstance(image_input, Image.Image):
            # PaddleOCR/PaddleX expects numpy array or file path
            processed_input = np.array(image_input.convert('RGB'))
        elif isinstance(image_input, np.ndarray):
            # Ensure it is a valid numpy array representing an image
            if len(image_input.shape) not in (2, 3):
                raise ValueError(f"Invalid numpy array shape for image: {image_input.shape}")
        else:
            raise TypeError("Unsupported image_input type. Must be a file path (str), PIL.Image, or numpy.ndarray.")

        # 2. Get the model and predict
        model = self._get_model()
        try:
            logger.info("Running PaddleOCR prediction...")
            results = model.predict(processed_input)
        except Exception as e:
            logger.error(f"Error during OCR prediction: {str(e)}")
            raise RuntimeError(f"OCR prediction failed: {str(e)}") from e

        # 3. Parse output structure
        lines = []
        full_text_parts = []

        if not results:
            return {
                "full_text": "",
                "lines": []
            }

        # In PaddleOCR 3.x, predict() returns a list of dictionaries (one for each image/page)
        for page_res in results:
            texts = page_res.get('rec_texts', [])
            scores = page_res.get('rec_scores', [])
            # Try to get polys or boxes
            boxes = page_res.get('rec_polys', page_res.get('rec_boxes', []))

            # If boxes is a numpy array, convert to list
            if isinstance(boxes, np.ndarray):
                boxes = boxes.tolist()

            for text, score, box in zip(texts, scores, boxes):
                # Ensure box is formatted as list of lists
                formatted_box = box
                if hasattr(box, 'tolist'):
                    formatted_box = box.tolist()
                elif isinstance(box, np.ndarray):
                    formatted_box = box.tolist()

                lines.append({
                    "text": text,
                    "box": formatted_box,
                    "confidence": float(score)
                })
                full_text_parts.append(text)

        full_text = "\n".join(full_text_parts)

        return {
            "full_text": full_text,
            "lines": lines
        }
