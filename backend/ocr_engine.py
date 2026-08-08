"""
ocr_engine.py
Owner: S1 (Joel Yoofi Godwyll)
Purpose: OCR extraction pipeline - image (textbook page photo) -> clean text.

Public contract (must stay stable - S4/Flask calls this directly):

    extract_text(image_path: str) -> dict
        {
            'text': str,               # clean concatenated text, reading order
            'confidence_mean': float,  # mean confidence of KEPT tokens (0-1)
            'token_count': int,        # number of text boxes kept after filtering
            'duration_ms': int         # wall-clock OCR time (preprocess + inference)
        }

Preprocessing pipeline (applied in this exact order, per spec section 2.2.3):
    1. Grayscale conversion
    2. Denoise (fastNlMeansDenoising)
    3. Adaptive threshold (binarise)
    4. Deskew if |skew angle| > 0.5 degrees
    5. Upscale via Pillow if shortest side < 800px

Confidence filtering (spec section 2.2.4):
    Keep only text boxes with confidence >= CONFIDENCE_THRESHOLD (0.70).
    Concatenate kept tokens into a single string, preserving reading order
    (sorted by top-left y-coordinate, then x-coordinate).
"""

import time
import logging

import cv2
import numpy as np
from PIL import Image
from paddleocr import PaddleOCR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr_engine")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CONFIDENCE_THRESHOLD = 0.70
MIN_SHORT_SIDE_PX = 800
DESKEW_ANGLE_THRESHOLD_DEG = 0.5
DENOISE_H = 10  # filter strength for fastNlMeansDenoising

# ---------------------------------------------------------------------------
# PaddleOCR initialisation (module-level singleton - load once, reuse)
# ---------------------------------------------------------------------------

_ocr_engine = None


def _get_ocr_engine() -> PaddleOCR:
    """Lazily initialise and cache the PaddleOCR engine instance."""
    global _ocr_engine
    if _ocr_engine is None:
        logger.info("Initialising PaddleOCR engine (use_angle_cls=True, lang='en')...")
        _ocr_engine = PaddleOCR(
            use_angle_cls=True,   # correct rotated / angled pages
            lang="en",
            use_gpu=False,        # Pi / laptop CPU-only
            show_log=False,
        )
    return _ocr_engine


# ---------------------------------------------------------------------------
# Preprocessing steps
# ---------------------------------------------------------------------------

def _to_grayscale(img: np.ndarray) -> np.ndarray:
    """Step 1: convert BGR image to grayscale."""
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def _denoise(gray: np.ndarray) -> np.ndarray:
    """Step 2: remove scan/photo noise."""
    return cv2.fastNlMeansDenoising(gray, h=DENOISE_H)


def _binarise(denoised: np.ndarray) -> np.ndarray:
    """Step 3: adaptive threshold to binarise for OCR."""
    return cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=11,
        C=2,
    )


def _estimate_skew_angle(binary: np.ndarray) -> float:
    """
    Estimate the skew angle (in degrees) of text in a binary image using
    minAreaRect over the largest text contours. Returns 0.0 if no usable
    contours are found.
    """
    # invert so text is white on black, which helps contour detection
    inverted = cv2.bitwise_not(binary)
    contours, _ = cv2.findContours(
        inverted, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return 0.0

    # combine all contour points into one set and fit a min-area rect
    all_points = np.concatenate(contours)
    rect = cv2.minAreaRect(all_points)
    angle = rect[-1]

    # cv2.minAreaRect returns angle in (-90, 0]; normalise to (-45, 45]
    if angle < -45:
        angle = 90 + angle
    return angle


def _deskew_if_needed(binary: np.ndarray) -> np.ndarray:
    """Step 4: deskew the image if the estimated skew exceeds the threshold."""
    angle = _estimate_skew_angle(binary)
    if abs(angle) <= DESKEW_ANGLE_THRESHOLD_DEG:
        return binary

    logger.info("Deskewing image: detected skew angle = %.2f deg", angle)
    (h, w) = binary.shape[:2]
    center = (w // 2, h // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    deskewed = cv2.warpAffine(
        binary,
        rotation_matrix,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return deskewed


def _upscale_if_small(binary: np.ndarray) -> np.ndarray:
    """Step 5: upscale via Pillow if shortest side < MIN_SHORT_SIDE_PX, preserving aspect ratio."""
    h, w = binary.shape[:2]
    short_side = min(h, w)
    if short_side >= MIN_SHORT_SIDE_PX:
        return binary

    scale = MIN_SHORT_SIDE_PX / short_side
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    logger.info(
        "Upscaling image from %dx%d to %dx%d (shortest side was %dpx)",
        w, h, new_w, new_h, short_side,
    )

    pil_img = Image.fromarray(binary)
    pil_img = pil_img.resize((new_w, new_h), Image.LANCZOS)
    return np.array(pil_img)


def _preprocess(image_path: str) -> np.ndarray:
    """Run the full preprocessing pipeline in the required order."""
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image at path: {image_path}")

    gray = _to_grayscale(img)
    denoised = _denoise(gray)
    binary = _binarise(denoised)
    deskewed = _deskew_if_needed(binary)
    final = _upscale_if_small(deskewed)
    return final


# ---------------------------------------------------------------------------
# Confidence filtering + reading-order reconstruction
# ---------------------------------------------------------------------------

def _filter_and_order(ocr_result) -> list:
    """
    Given raw PaddleOCR output for a single image, keep only boxes with
    confidence >= CONFIDENCE_THRESHOLD, and sort by top-left y then x
    coordinate to approximate natural reading order.

    Returns a list of dicts: [{'text': str, 'confidence': float, 'y': float, 'x': float}, ...]
    """
    kept = []

    if not ocr_result or ocr_result[0] is None:
        return kept

    for line in ocr_result[0]:
        box, (text, confidence) = line
        if confidence < CONFIDENCE_THRESHOLD:
            continue

        # box is a list of 4 [x, y] points (top-left, top-right, bottom-right, bottom-left)
        top_left = box[0]
        kept.append(
            {
                "text": text,
                "confidence": float(confidence),
                "x": float(top_left[0]),
                "y": float(top_left[1]),
            }
        )

    # sort by y first (line order), then x (left-to-right within a line)
    kept.sort(key=lambda t: (t["y"], t["x"]))
    return kept


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_text(image_path: str) -> dict:
    """
    Run the full OCR pipeline on a textbook page photo.

    Args:
        image_path: path to a JPEG/PNG image on disk.

    Returns:
        dict with keys: text, confidence_mean, token_count, duration_ms
    """
    start = time.perf_counter()

    preprocessed = _preprocess(image_path)

    ocr = _get_ocr_engine()
    raw_result = ocr.ocr(preprocessed, cls=True)

    kept_tokens = _filter_and_order(raw_result)

    text = " ".join(t["text"] for t in kept_tokens)
    confidence_mean = (
        sum(t["confidence"] for t in kept_tokens) / len(kept_tokens)
        if kept_tokens
        else 0.0
    )

    duration_ms = int((time.perf_counter() - start) * 1000)

    if duration_ms > 5000:
        logger.warning(
            "extract_text() took %dms (> 5000ms) - flag to S5, latency budget risk.",
            duration_ms,
        )

    return {
        "text": text,
        "confidence_mean": round(confidence_mean, 4),
        "token_count": len(kept_tokens),
        "duration_ms": duration_ms,
    }


# ---------------------------------------------------------------------------
# Manual smoke test - run directly: python ocr_engine.py path/to/image.jpg
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python ocr_engine.py <path_to_image>")
        sys.exit(1)

    result = extract_text(sys.argv[1])
    print(f"Text ({result['token_count']} tokens, "
          f"mean confidence {result['confidence_mean']}, "
          f"{result['duration_ms']}ms):\n")
    print(result["text"])
