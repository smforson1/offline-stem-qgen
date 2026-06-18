import argparse
import sys
import os
import logging
from PIL import Image, ImageDraw

# Set up simple logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ocr_test_runner")

def create_temp_test_image(text: str = "Newton's Second Law:\nF = m * a\nwhere F is force, m is mass, and a is acceleration.") -> str:
    """Creates a temporary image with printed text to test OCR."""
    temp_path = "temp_test_ocr.png"
    # Create white image
    img = Image.new('RGB', (600, 150), color='white')
    draw = ImageDraw.Draw(img)
    # Simple draw text (since default font might be tiny, we draw it line by line)
    lines = text.split('\n')
    y_offset = 20
    for line in lines:
        draw.text((30, y_offset), line, fill='black')
        y_offset += 35
    img.save(temp_path)
    logger.info(f"Created temporary test image at: {temp_path}")
    return temp_path

def main():
    parser = argparse.ArgumentParser(description="Test runner for S1 OCR Engine")
    parser.add_argument("--image", type=str, help="Path to image file to OCR")
    parser.add_argument("--lang", type=str, default="en", help="Language code (default: en)")
    args = parser.parse_args()

    # Add directory path to Python sys.path to resolve ocr_engine relative import
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(current_dir)
    
    try:
        from ocr_engine import OcrEngine
    except ImportError:
        # Fallback if run from project root
        sys.path.append(os.path.join(current_dir, "..", "backend"))
        from ocr_engine import OcrEngine

    temp_image_created = False
    image_path = args.image

    if not image_path:
        logger.info("No --image path provided. Generating a temporary image containing math text...")
        image_path = create_temp_test_image()
        temp_image_created = True

    try:
        engine = OcrEngine(lang=args.lang)
        logger.info(f"Extracting text from: {image_path}")
        result = engine.extract_text_from_image(image_path)

        print("\n" + "="*50)
        print(" EXTRACTED FULL TEXT ")
        print("="*50)
        print(result["full_text"])
        print("="*50 + "\n")

        print("DETAILED LINE SEGMENTS:")
        for idx, line in enumerate(result["lines"]):
            print(f"[{idx+1}] Text: {line['text']!r} (Conf: {line['confidence']:.3f})")
            print(f"    Bounding Box: {line['box']}")

    except Exception as e:
        logger.exception("An error occurred during OCR verification:")
        sys.exit(1)
    finally:
        if temp_image_created and os.path.exists(image_path):
            try:
                os.remove(image_path)
                logger.info(f"Cleaned up temporary image at: {image_path}")
            except Exception as e:
                logger.warning(f"Could not remove temporary image: {str(e)}")

if __name__ == "__main__":
    main()
