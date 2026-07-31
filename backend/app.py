# Owner: S4 | Purpose: Flask REST API — routes for OCR, question generation, and PDF export

import os
import sys
import time
import logging
import io
import sqlite3
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename

# Add current directory to path to locate config and ocr_engine
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from config import Config
from ocr_engine import OcrEngine
from pdf_export import PdfExporter
from prompt_builder import PromptBuilder
from validator import Validator
from llm_engine import LlmEngine

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

# Global cache of LLM engine and Prompt Builder
_llm_engine = None
_prompt_builder = None

def get_llm_engine() -> LlmEngine:
    global _llm_engine
    if _llm_engine is None:
        logger.info("Initializing LlmEngine...")
        _llm_engine = LlmEngine(model_path=Config.MODEL_PATH)
    return _llm_engine

def get_prompt_builder() -> PromptBuilder:
    global _prompt_builder
    if _prompt_builder is None:
        _prompt_builder = PromptBuilder()
    return _prompt_builder

def init_db():
    """Initializes the database using schema.sql if the schema doesn't exist yet."""
    db_path = Config.DATABASE_PATH
    schema_path = os.path.join(current_dir, "schema.sql")
    
    db_exists = os.path.exists(db_path)
    if not db_exists:
        logger.info(f"Database file not found. Creating at {db_path}...")

    try:
        conn = sqlite3.connect(db_path)
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
        conn.executescript(schema_sql)
        conn.commit()
        conn.close()
        logger.info("SQLite Database tables verified/initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")

def get_db_connection():
    """Returns a new SQLite connection with dict-like row parsing."""
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

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
    """
    POST /generate
    Generates STEM practice questions from OCR'd text using a local LLM.
    Body format:
    {
      "context_text": "textbook text...",
      "subject": "Physics",           # optional
      "difficulty": "Medium",         # optional
      "question_type": "mcq",         # optional (mcq or short_answer)
      "num_questions": 5,             # optional, how many questions to generate (default 3)
      "session_id": "optional_id"     # optional, auto-generated if missing
    }
    """
    import uuid
    import json
    data = request.get_json(silent=True) or {}
    
    context_text = data.get("context_text")
    if not context_text or not isinstance(context_text, str):
        return jsonify({
            "success": False,
            "error": "Missing or invalid 'context_text' in JSON body."
        }), 400

    subject = data.get("subject", "STEM")
    difficulty = data.get("difficulty", "Medium")
    question_type = data.get("question_type", "mcq")
    num_questions = int(data.get("num_questions", 3))  # default 3, caller can request more
    
    # Resolve or create session ID
    session_id = data.get("session_id")
    if not session_id:
        session_id = f"sess_{uuid.uuid4().hex[:12]}"

    try:
        # 1. Compile prompt using builder
        prompt_builder = get_prompt_builder()
        prompt = prompt_builder.build_prompt(
            context_text=context_text,
            subject=subject,
            difficulty=difficulty,
            question_type=question_type,
            num_questions=num_questions
        )
        
        # 2. Query LlmEngine
        llm = get_llm_engine()
        raw_response = llm.generate_response(prompt, num_questions=num_questions)
        
        # 3. Validate and Parse response JSON
        questions = Validator.validate_and_parse_response(
            raw_llm_text=raw_response,
            question_type=question_type
        )
        
        # 4. Insert into SQLite Database
        conn = get_db_connection()
        # Insert session (ignoring if it already exists)
        conn.execute(
            "INSERT OR IGNORE INTO sessions (id, subject, difficulty, raw_context) VALUES (?, ?, ?, ?)",
            (session_id, subject, difficulty, context_text)
        )
        
        # Insert questions
        for idx, q in enumerate(questions):
            q_id = f"q_{session_id}_{idx}_{uuid.uuid4().hex[:6]}"
            conn.execute(
                "INSERT INTO questions (id, session_id, question_text, correct_answer, explanation, options_json) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    q_id,
                    session_id,
                    q["question_text"],
                    q["correct_answer"],
                    q["explanation"],
                    q["options_json"]
                )
            )
        conn.commit()
        conn.close()
        
        # 5. Formulate final response (including the DB-inserted UUIDs)
        # Convert options back to list for response output
        response_questions = []
        for idx, q in enumerate(questions):
            opts = None
            if q["options_json"]:
                opts = json.loads(q["options_json"])
            response_questions.append({
                "question_text": q["question_text"],
                "options": opts,
                "correct_answer": q["correct_answer"],
                "explanation": q["explanation"]
            })
            
        return jsonify({
            "success": True,
            "session_id": session_id,
            "questions": response_questions
        }), 200

    except Exception as e:
        logger.exception("Question generation route failed")
        return jsonify({
            "success": False,
            "error": f"Failed to generate questions: {str(e)}"
        }), 500


@app.route("/export", methods=["POST"])
def export():
    """
    POST /export
    Compiles questions into a ReportLab PDF download.
    Can accept:
    1. A list of questions passed directly in the JSON body.
    2. A 'session_id' in JSON body or query param to retrieve questions from the SQLite DB.
    """
    data = request.get_json(silent=True)
    if data is None:
        data = {}
    questions = []
    subject = "STEM"
    difficulty = "Medium"

    # 1. Check if session_id is provided to fetch from SQLite Database
    session_id = None
    if isinstance(data, dict):
        session_id = data.get("session_id")
    if not session_id:
        session_id = request.args.get("session_id")
    if session_id:
        try:
            conn = get_db_connection()
            session = conn.execute(
                "SELECT subject, difficulty FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            
            if not session:
                conn.close()
                return jsonify({
                    "success": False,
                    "error": f"Session with ID '{session_id}' not found."
                }), 404
                
            subject = session["subject"]
            difficulty = session["difficulty"]
            
            db_qs = conn.execute(
                "SELECT question_text, correct_answer, explanation, options_json FROM questions WHERE session_id = ?",
                (session_id,)
            ).fetchall()
            conn.close()
            
            questions = [dict(q) for q in db_qs]
            
        except Exception as e:
            logger.exception("Database query failed during PDF export")
            return jsonify({
                "success": False,
                "error": f"Failed to retrieve questions from database: {str(e)}"
            }), 500
    else:
        # 2. Otherwise expect raw questions in the body
        if isinstance(data, list):
            questions = data
        elif isinstance(data, dict):
            questions = data.get("questions", [])
            subject = data.get("subject", subject)
            difficulty = data.get("difficulty", difficulty)

    if not questions:
        return jsonify({
            "success": False,
            "error": "No questions provided or found for the given session ID."
        }), 400

    try:
        # 3. Generate PDF Bytes
        pdf_bytes = PdfExporter.generate_pdf_bytes(
            questions, 
            subject=subject, 
            difficulty=difficulty
        )
        
        # 4. Stream PDF
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{subject.lower()}_practice_worksheet.pdf"
        )
        
    except Exception as e:
        logger.exception("PDF generation failed in export route")
        return jsonify({
            "success": False,
            "error": f"Failed to generate PDF: {str(e)}"
        }), 500

if __name__ == "__main__":
    # Initialize SQLite Database tables
    init_db()
    
    logger.info(f"Starting offline-stem-qgen API server on {Config.HOST}:{Config.PORT}...")
    app.run(host=Config.HOST, port=Config.PORT, debug=False)
