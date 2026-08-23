# Owner: S4 | Purpose: Centralised config (model path, port, DB path) — reads from .env

import os

# Base directory of the backend folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Manually load .env file if it exists to avoid requiring external packages
def _load_env():
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

_load_env()

class Config:
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", 5000))
    DATABASE_PATH = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "stem_qgen.db"))
    UPLOADS_DIR = os.environ.get("UPLOADS_DIR", os.path.join(BASE_DIR, "data", "uploads"))
    OCR_LANG = os.environ.get("OCR_LANG", "en")
    fast_model = os.path.join(BASE_DIR, "data", "models", "qwen2.5-0.5b-instruct-q4_k_m.gguf")
    default_model = fast_model if os.path.exists(fast_model) else os.path.join(BASE_DIR, "data", "models", "model.gguf")
    MODEL_PATH = os.environ.get("MODEL_PATH", default_model)
    
    # Cloud Optimization API settings
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    # Make sure the uploads directory is created at startup
    os.makedirs(UPLOADS_DIR, exist_ok=True)
