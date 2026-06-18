# Owner: S4 | Purpose: Centralised config (model path, port, DB path) — reads from .env

import os

# Base directory of the backend folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Config:
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", 5000))
    DATABASE_PATH = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "stem_qgen.db"))
    UPLOADS_DIR = os.environ.get("UPLOADS_DIR", os.path.join(BASE_DIR, "data", "uploads"))
    OCR_LANG = os.environ.get("OCR_LANG", "en")
    
    # Make sure the uploads directory is created at startup
    os.makedirs(UPLOADS_DIR, exist_ok=True)
