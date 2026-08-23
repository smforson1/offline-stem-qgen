# Owner: S4 | Purpose: Flask REST API — routes for OCR, question generation, and PDF export

import os
import sys
import time
import logging
import io
import sqlite3
import hashlib
from functools import lru_cache
from typing import Optional
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename

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
# Reject uploads larger than 8 MB early — prevents long blocking reads of huge files
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024

# ── OCR engine cache (one instance per language) ──────────────────────────────
_ocr_engines: dict = {}

def get_ocr_engine(lang: str) -> OcrEngine:
    """Lazily load and cache OCR engines by language."""
    if lang not in _ocr_engines:
        logger.info(f"Creating new OcrEngine instance for language: {lang}")
        _ocr_engines[lang] = OcrEngine(lang=lang, device='cpu', enable_mkldnn=False)
    return _ocr_engines[lang]

# ── In-memory OCR result cache (keyed by image hash + lang) ───────────────────
_ocr_cache: dict = {}
_OCR_CACHE_MAX = 10

def cached_ocr(image_bytes: bytes, lang: str) -> dict:
    """
    Return OCR results for given image bytes. Results are cached by MD5 hash
    so repeated uploads of the same image skip the expensive OCR pipeline.
    Image stays entirely in memory — no disk write.
    """
    key = hashlib.md5(image_bytes).hexdigest() + lang
    if key in _ocr_cache:
        logger.info(f"OCR cache hit for key {key[:8]}...")
        return _ocr_cache[key]

    # Decode bytes → PIL Image → numpy array (no disk I/O)
    import io as _io
    from PIL import Image as _Image
    import numpy as _np
    try:
        pil_img = _Image.open(_io.BytesIO(image_bytes)).convert('RGB')
        # Pre-resize: cap longest side at 1200px for faster OCR
        max_side = 1200
        w, h = pil_img.size
        if max(w, h) > max_side:
            scale = max_side / max(w, h)
            pil_img = pil_img.resize((int(w * scale), int(h * scale)), _Image.LANCZOS)
            logger.info(f"Pre-resized image from {w}x{h} → {pil_img.size} for OCR.")
        img_array = _np.array(pil_img)
    except Exception as e:
        logger.warning(f"In-memory image decode failed, falling back to temp file: {e}")
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name
        try:
            engine = get_ocr_engine(lang)
            result = engine.extract_text_from_image(tmp_path)
            _store_ocr_cache(key, result)
            return result
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    engine = get_ocr_engine(lang)
    result = engine.extract_text_from_image(img_array)
    _store_ocr_cache(key, result)
    return result

def _store_ocr_cache(key: str, result: dict) -> None:
    """Store result in OCR cache, evicting oldest entry if full."""
    if len(_ocr_cache) >= _OCR_CACHE_MAX:
        oldest = next(iter(_ocr_cache))
        del _ocr_cache[oldest]
    _ocr_cache[key] = result

# ── LLM engine and Prompt Builder ─────────────────────────────────────────────
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

# ── Database helpers ───────────────────────────────────────────────────────────
def init_db():
    """Initializes the database using schema.sql if the schema doesn't exist yet."""
    db_path = Config.DATABASE_PATH
    schema_path = os.path.join(current_dir, "schema.sql")
    if not os.path.exists(db_path):
        logger.info(f"Database file not found. Creating at {db_path}...")
    try:
        conn = sqlite3.connect(db_path)
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
        conn.executescript(schema_sql)
        # Add indexes for the most common queries — speeds up history and results loading
        conn.executescript("""
            CREATE INDEX IF NOT EXISTS idx_questions_session
                ON questions(session_id);
            CREATE INDEX IF NOT EXISTS idx_answers_session
                ON answers(session_id);
            CREATE INDEX IF NOT EXISTS idx_answers_question
                ON answers(question_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_created
                ON sessions(created_at DESC);
        """)
        conn.commit()
        conn.close()
        logger.info("SQLite Database tables and indexes verified/initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")

def get_db_connection():
    """Returns a new SQLite connection with dict-like row parsing."""
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

# ── Utility helpers ────────────────────────────────────────────────────────────
def auto_detect_num_questions(text: str) -> int:
    """
    Infers how many questions the AI should generate based on content richness.
    Counts unique meaningful words in the OCR text as a proxy for concept density:
      - < 80 unique words  → 3 questions (sparse slide)
      - 80–180 unique words → 5 questions (typical slide)
      - > 180 unique words  → 8 questions (content-rich page)
    """
    words = [w.lower() for w in text.split() if w.isalpha() and len(w) >= 4]
    unique_count = len(set(words))
    if unique_count < 80:
        return 3
    elif unique_count <= 180:
        return 5
    else:
        return 8

def auto_detect_difficulty(text: str) -> str:
    """
    Infers question difficulty from OCR text vocabulary complexity.
    Average word length > 7 → Hard, 5-7 → Medium, < 5 → Easy.
    """
    words = [w for w in text.split() if w.isalpha()]
    if not words:
        return "Medium"
    avg_len = sum(len(w) for w in words) / len(words)
    if avg_len > 7:
        return "Hard"
    elif avg_len >= 5:
        return "Medium"
    else:
        return "Easy"

def generate_with_retry(llm, prompt: str, question_type: str, num_questions: int, max_retries: int = 2) -> list:
    """
    Calls the LLM and validates the response. Retries up to max_retries times
    with a slightly increased temperature on each attempt to break out of a bad
    generation pattern.
    """
    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            temperature_bump = attempt * 0.1
            raw = llm.generate_response(prompt, num_questions=num_questions, question_type=question_type, temperature_bump=temperature_bump)
            return Validator.validate_and_parse_response(raw_llm_text=raw, question_type=question_type)
        except (ValueError, RuntimeError) as e:
            last_error = e
            logger.warning(f"Generation attempt {attempt + 1} failed: {e}. {'Retrying...' if attempt < max_retries else 'Giving up.'}")
    if last_error is not None:
        raise last_error
    raise RuntimeError("Question generation failed.")

# ── CORS ───────────────────────────────────────────────────────────────────────
@app.after_request
def add_cors_headers(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    return response

# ── Routes ─────────────────────────────────────────────────────────────────────
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
        return jsonify({"success": False, "error": "Missing 'image' file in multipart form-data."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"success": False, "error": "No file selected."}), 400

    lang = request.form.get("lang", Config.OCR_LANG)

    try:
        # Read entirely into memory — no disk write needed
        file_bytes = file.read()
        logger.info(f"Received image upload ({len(file_bytes)} bytes), lang={lang}")
        result = cached_ocr(file_bytes, lang)
        return jsonify({
            "success": True,
            "full_text": result["full_text"],
            "lines": result["lines"]
        }), 200
    except Exception as e:
        logger.exception("Exception occurred during OCR route processing")
        return jsonify({"success": False, "error": f"OCR processing failed: {str(e)}"}), 500

@app.route("/generate", methods=["POST"])
def generate():
    """
    POST /generate
    Generates STEM practice questions from OCR'd text using a local LLM.
    Body: { context_text, subject, difficulty, question_type, num_questions, session_id }
    """
    import uuid
    import json
    data = request.get_json(silent=True) or {}

    context_text = data.get("context_text")
    if not context_text or not isinstance(context_text, str):
        return jsonify({"success": False, "error": "Missing or invalid 'context_text' in JSON body."}), 400

    subject = data.get("subject", "STEM")
    difficulty = data.get("difficulty", "Medium")
    question_type = data.get("question_type", "mcq")
    num_questions = int(data.get("num_questions", 3))

    if num_questions == 0:
        num_questions = auto_detect_num_questions(context_text)
        logger.info(f"AI-decided num_questions: {num_questions} (based on context richness)")

    if difficulty == "Auto" or not difficulty:
        difficulty = auto_detect_difficulty(context_text)
        logger.info(f"Auto-detected difficulty: {difficulty}")

    session_id = data.get("session_id") or f"sess_{uuid.uuid4().hex[:12]}"

    try:
        prompt_builder = get_prompt_builder()
        prompt = prompt_builder.build_prompt(
            context_text=context_text,
            subject=subject,
            difficulty=difficulty,
            question_type=question_type,
            num_questions=num_questions
        )

        llm = get_llm_engine()
        questions = generate_with_retry(llm, prompt, question_type, num_questions)

        conn = get_db_connection()
        conn.execute(
            "INSERT OR IGNORE INTO sessions (id, subject, difficulty, raw_context) VALUES (?, ?, ?, ?)",
            (session_id, subject, difficulty, context_text)
        )
        for idx, q in enumerate(questions):
            q_id = f"q_{session_id}_{idx}_{uuid.uuid4().hex[:6]}"
            conn.execute(
                "INSERT INTO questions (id, session_id, question_text, correct_answer, explanation, options_json) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (q_id, session_id, q["question_text"], q["correct_answer"], q["explanation"], q["options_json"])
            )
        conn.commit()
        conn.close()

        response_questions = []
        for q in questions:
            opts = json.loads(q["options_json"]) if q["options_json"] else None
            response_questions.append({
                "question_text": q["question_text"],
                "options": opts,
                "correct_answer": q["correct_answer"],
                "explanation": q["explanation"]
            })

        return jsonify({"success": True, "session_id": session_id, "questions": response_questions}), 200

    except Exception as e:
        logger.exception("Question generation route failed")
        return jsonify({"success": False, "error": f"Failed to generate questions: {str(e)}"}), 500


@app.route("/generate/stream", methods=["POST"])
def generate_stream():
    """
    POST /generate/stream
    Same as /generate but streams Server-Sent Events (SSE):
      progress: { question_index, total }
      done:     { session_id, questions }
      error:    { error }
    """
    import uuid
    import json
    from flask import Response, stream_with_context

    data = request.get_json(silent=True) or {}

    context_text = data.get("context_text")
    if not context_text or not isinstance(context_text, str):
        return jsonify({"success": False, "error": "Missing or invalid 'context_text'."}), 400

    subject = data.get("subject", "STEM")
    difficulty = data.get("difficulty", "Medium")
    question_type = data.get("question_type", "mcq")
    num_questions = int(data.get("num_questions", 3))

    if num_questions == 0:
        num_questions = auto_detect_num_questions(context_text)
        logger.info(f"Stream: AI-decided num_questions: {num_questions} (based on context richness)")

    if difficulty == "Auto" or not difficulty:
        difficulty = auto_detect_difficulty(context_text)
        logger.info(f"Stream: auto-detected difficulty: {difficulty}")

    session_id = data.get("session_id") or f"sess_{uuid.uuid4().hex[:12]}"

    def sse_event(event: str, payload: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(payload)}\n\n"

    @stream_with_context
    def generate_sse():
        try:
            prompt_builder = get_prompt_builder()
            prompt = prompt_builder.build_prompt(
                context_text=context_text,
                subject=subject,
                difficulty=difficulty,
                question_type=question_type,
                num_questions=num_questions,
            )

            llm = get_llm_engine()
            accumulated = ""
            last_yielded_n = 0
            for token in llm.generate_response_stream(prompt, num_questions=num_questions, question_type=question_type):
                accumulated += token
                try:
                    partial = json.loads(accumulated + "}}")
                    n_so_far = len(partial.get("questions", []))
                except Exception:
                    n_so_far = accumulated.count('"question_text"')
                if n_so_far > last_yielded_n:
                    last_yielded_n = n_so_far
                    yield sse_event("progress", {"question_index": n_so_far, "total": num_questions})

            logger.info(f"Streaming complete. Accumulated {len(accumulated)} chars. Preview: {accumulated[:200]!r}")
            last_err: Optional[Exception] = None
            questions = None
            for attempt in range(3):
                try:
                    questions = Validator.validate_and_parse_response(
                        raw_llm_text=accumulated,
                        question_type=question_type,
                    )
                    break
                except (ValueError, RuntimeError) as e:
                    last_err = e
                    logger.warning(f"Stream validation attempt {attempt+1} failed: {e}")
                    if attempt < 2:
                        accumulated = ""
                        for token in llm.generate_response_stream(prompt, num_questions=num_questions, question_type=question_type, temperature_bump=(attempt+1)*0.1):
                            accumulated += token
            if questions is None:
                if last_err is not None:
                    raise last_err
                raise RuntimeError("Stream validation failed.")

            conn = get_db_connection()
            conn.execute(
                "INSERT OR IGNORE INTO sessions (id, subject, difficulty, raw_context) VALUES (?, ?, ?, ?)",
                (session_id, subject, difficulty, context_text),
            )
            for idx, q in enumerate(questions):
                q_id = f"q_{session_id}_{idx}_{uuid.uuid4().hex[:6]}"
                conn.execute(
                    "INSERT INTO questions (id, session_id, question_text, correct_answer, explanation, options_json) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (q_id, session_id, q["question_text"], q["correct_answer"], q["explanation"], q["options_json"]),
                )
            conn.commit()
            conn.close()

            response_questions = []
            for q in questions:
                opts = json.loads(q["options_json"]) if q["options_json"] else None
                response_questions.append({
                    "question_text": q["question_text"],
                    "options": opts,
                    "correct_answer": q["correct_answer"],
                    "explanation": q["explanation"],
                })

            yield sse_event("done", {"session_id": session_id, "questions": response_questions})

        except Exception as e:
            logger.exception("Streaming generation failed")
            yield sse_event("error", {"error": str(e)})

    return Response(
        generate_sse(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/export", methods=["POST"])
def export():
    """POST /export — generate a PDF from a session ID or inline questions."""
    data = request.get_json(silent=True) or {}
    questions = []
    subject = "STEM"
    difficulty = "Medium"

    session_id = (data.get("session_id") if isinstance(data, dict) else None) or request.args.get("session_id")
    if session_id:
        try:
            conn = get_db_connection()
            session = conn.execute(
                "SELECT subject, difficulty FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if not session:
                conn.close()
                return jsonify({"success": False, "error": f"Session '{session_id}' not found."}), 404
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
            return jsonify({"success": False, "error": f"Failed to retrieve questions: {str(e)}"}), 500
    else:
        if isinstance(data, list):
            questions = data
        elif isinstance(data, dict):
            questions = data.get("questions", [])
            subject = data.get("subject", subject)
            difficulty = data.get("difficulty", difficulty)

    if not questions:
        return jsonify({"success": False, "error": "No questions provided or found."}), 400

    try:
        pdf_bytes = PdfExporter.generate_pdf_bytes(questions, subject=subject, difficulty=difficulty)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{subject.lower()}_practice_worksheet.pdf"
        )
    except Exception as e:
        logger.exception("PDF generation failed")
        return jsonify({"success": False, "error": f"Failed to generate PDF: {str(e)}"}), 500


if __name__ == "__main__":
    init_db()

    # In production (debug=False), reduce noisy werkzeug request logs to WARNING
    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    # Warm up OCR engine at startup so the first scan doesn't pay the model-loading cost
    logger.info("Warming up OCR engine for default language...")
    try:
        get_ocr_engine(Config.OCR_LANG)._get_model()
        logger.info("OCR engine warmed up successfully.")
    except Exception as e:
        logger.warning(f"OCR warm-up failed (non-fatal): {e}")

    logger.info(f"Starting ScanQ API server on {Config.HOST}:{Config.PORT}...")
    app.run(host=Config.HOST, port=Config.PORT, debug=False)
