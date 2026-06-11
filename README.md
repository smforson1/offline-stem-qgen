# offline-stem-qgen

An offline-first STEM question generator that uses on-device OCR and a local LLM to produce practice questions from textbook photos, exportable as PDFs — no internet required.

---

## Getting Started

### S1 — OCR Engine
1. `cd backend && python -m venv venv && source venv/bin/activate`
2. `pip install paddleocr paddlepaddle pillow`
3. Work in `backend/ocr_engine.py`; add test images to `backend/data/ocr_benchmark/`
4. Run benchmarks: `python analysis/ocr_benchmark.py`

### S2 — LLM Engine
1. Activate the backend venv (see S1 above)
2. `pip install llama-cpp-python`
3. Place your `.gguf` model in `backend/data/models/` (git-ignored)
4. Work in `backend/llm_engine.py`, `backend/prompt_builder.py`, `backend/validator.py`
5. Add/edit prompt templates in `backend/prompts/`

### S3 — React Native App
1. `cd rn_app && npm install`
2. `npx react-native run-android` (or `run-ios`)
3. Screens live in `src/screens/`, shared state in `src/store/`, API calls in `src/api/`
4. Local DB helpers in `src/db/`, TypeScript types in `src/types/`

### S4 — Backend / DB / Infra
1. `cd backend && python -m venv venv && source venv/bin/activate`
2. `pip install flask reportlab`
3. Init DB: `sqlite3 backend/stem_qgen.db < backend/schema.sql`
4. Start API: `python backend/app.py`
5. Or via Docker: `docker compose up --build`
6. Pi setup: `bash scripts/setup_pi.sh`

### S5 — PM / Pilot / Analysis
1. `pip install pandas scipy matplotlib`
2. Survey CSVs go in `data/surveys/` (git-ignored)
3. Update `data/gold_standard.json` with verified Q&A pairs
4. Run analysis: `python analysis/pilot_analysis.py`
5. Docs live in `docs/`; ethics forms in `ethics/`
