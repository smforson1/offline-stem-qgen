# Owner: S4 | Purpose: Flask REST API — routes for OCR, question generation, and PDF export

import os
import sys
import time
import logging
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

# Add current directory to path to locate config and ocr_engine
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from config import Config
from ocr_engine import OcrEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("flask_app")

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Global cache of OCR engine instances (one per language)
_ocr_engines = {}

def get_ocr_engine(lang: str) -> OcrEngine:
    """Helper to lazily load and cache OCR engines by language."""
    if lang not in _ocr_engines:
        logger.info(f"Creating new OcrEngine instance for language: {lang}")
        # Always run on CPU with MKLDNN disabled for stable local CPU execution
        _ocr_engines[lang] = OcrEngine(lang=lang, device='cpu', enable_mkldnn=False)
    return _ocr_engines[lang]

@app.after_request
def add_cors_headers(response):
    """Ensure CORS is handled properly for local network API requests."""
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    return response

@app.route("/health", methods=["GET"])
def health():
    """Service health and connection check endpoint."""
    return jsonify({
        "status": "healthy",
        "api_version": "1.0.0",
        "timestamp": int(time.time())
    }), 200

@app.route("/ocr", methods=["POST"])
def ocr_endpoint():
    """
    POST /ocr
    Expects multipart form-data with:
    - 'image': The textbook page image file.
    - 'lang': Optional language code (defaults to 'en').
    """
    if "image" not in request.files:
        return jsonify({
            "success": False,
            "error": "Missing 'image' file in multipart form-data."
        }), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({
            "success": False,
            "error": "No file selected."
        }), 400

    lang = request.form.get("lang", Config.OCR_LANG)
    
    # Save the file temporarily
    filename = secure_filename(file.filename)
    if not filename:
        filename = f"upload_{int(time.time())}.png"
        
    temp_path = os.path.join(Config.UPLOADS_DIR, filename)
    
    try:
        logger.info(f"Saving uploaded file to {temp_path}...")
        file.save(temp_path)
        
        # Get OCR engine and extract text
        engine = get_ocr_engine(lang)
        result = engine.extract_text_from_image(temp_path)
        
        return jsonify({
            "success": True,
            "full_text": result["full_text"],
            "lines": result["lines"]
        }), 200
        
    except Exception as e:
        logger.exception("Exception occurred during OCR route processing")
        return jsonify({
            "success": False,
            "error": f"OCR processing failed: {str(e)}"
        }), 500
        
    finally:
        # Make sure we delete the temporary uploaded file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.info(f"Successfully deleted temporary file: {temp_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temporary file {temp_path}: {str(e)}")

@app.route("/generate", methods=["POST"])
def generate():
    """Stub for LLM question generation."""
    return jsonify({
        "success": False,
        "error": "Endpoint `/generate` is not implemented yet. LLM engine is undergoing configuration."
    }), 501

@app.route("/export", methods=["POST"])
def export():
    """Stub for ReportLab PDF generation."""
    return jsonify({
        "success": False,
        "error": "Endpoint `/export` is not implemented yet. PDF export engine is undergoing configuration."
    }), 501

if __name__ == "__main__":
    logger.info(f"Starting offline-stem-qgen API server on {Config.HOST}:{Config.PORT}...")
    app.run(host=Config.HOST, port=Config.PORT, debug=False)
