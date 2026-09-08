# ScanQ — Project Documentation

**CS Department | 2026 Batch | Group 6 | Project 20**
**Supervisor: Eric Opoku Osei**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Group Members and Roles](#2-group-members-and-roles)
3. [System Architecture](#3-system-architecture)
4. [Backend Documentation](#4-backend-documentation)
5. [Frontend Documentation](#5-frontend-documentation)
6. [Data Flow](#6-data-flow)
7. [Database Schema](#7-database-schema)
8. [Setup and Deployment Guide](#8-setup-and-deployment-guide)
9. [Known Limitations](#9-known-limitations)

---

## 1. Project Overview

ScanQ is an offline-first STEM question generation system designed for Ghanaian JHS/SHS teachers. A teacher photographs or uploads a textbook page, the system extracts the text using PaddleOCR, and a local language model generates structured practice questions — either multiple choice or short answer — from that text. The generated questions can be answered, scored, reviewed, and exported as a PDF worksheet, all without requiring an internet connection after initial setup.

The application is named **ScanQ** — a portmanteau of "Scan" (the OCR input method) and "Q" (questions).

### Core Capabilities

- Camera capture or gallery image upload of textbook pages
- Server-side OCR text extraction via PaddleOCR
- AI question generation in MCQ and short-answer formats
- Configurable subject, difficulty, question count, and format per session
- Real-time streaming progress during generation
- SQLite-backed local question history
- Score tracking and per-question review
- PDF worksheet export
- Onboarding flow for first-time users
- Backend connection settings screen

---

## 2. Group Members and Roles

| # | Index No. | Full Name | Role | Key Deliverables |
|---|-----------|-----------|------|-----------------|
| S1 | 9021023 | GODWYLL, Joel Yoofi | OCR Engineer | PaddleOCR integration (`ocr_engine.py`), image preprocessing pipeline, OCR benchmark |
| S2 | 9021223 | GYABAAH, Linus Kwasi | LLM Engineer | GGUF model deployment, prompt engineering (`prompt_builder.py`, `prompts/`), output validator (`validator.py`), `llm_engine.py` |
| S3 | 9021123 | GOTAH, Benjamin | Mobile Developer | React Native (Expo) frontend — all screens, navigation, UI components, local SQLite repositories |
| S4 | 9021323 | GYAMFI, Helis Kisiwaa | Backend / Database | Flask API (`app.py`), SQLite schema (`schema.sql`), PDF export (`pdf_export.py`), backend configuration (`config.py`) |
| S5 | 9019223 | Forson Samuel Mintah | PM / Pilot Coordinator | Teacher pilot study, survey design, BLEU evaluation, manuscript, Gantt maintenance, ethics clearance |

---

## 3. System Architecture

```
┌─────────────────────────────────────┐
│         Android Phone               │
│  ┌─────────────────────────────┐    │
│  │  ScanQ (React Native/Expo)  │    │
│  │  - Onboarding               │    │
│  │  - Home Dashboard           │    │
│  │  - Capture (Camera/Gallery) │    │
│  │  - Question Screen          │    │
│  │  - Results Screen           │    │
│  │  - History Screen           │    │
│  │  - Settings Screen          │    │
│  └──────────────┬──────────────┘    │
│                 │ HTTP over LAN      │
└─────────────────┼───────────────────┘
                  │
          Local Wi-Fi Network
          (no internet required)
                  │
┌─────────────────▼───────────────────┐
│            Laptop Server            │
│  ┌──────────────────────────────┐   │
│  │  Flask API (app.py, port 5000)│  │
│  │  ┌──────────┐ ┌────────────┐ │  │
│  │  │PaddleOCR │ │PromptBuilder│ │  │
│  │  └──────────┘ └─────┬──────┘ │  │
│  │                     │        │  │
│  │  ┌──────────────────▼──────┐ │  │
│  │  │     LlmEngine           │ │  │
│  │  │  Qwen2.5-0.5B GGUF      │ │  │
│  │  │  (llama-cpp-python)     │ │  │
│  │  └──────────────────┬──────┘ │  │
│  │                     │        │  │
│  │  ┌──────────────────▼──────┐ │  │
│  │  │  Validator + SQLite DB  │ │  │
│  │  └─────────────────────────┘ │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Component Summary

| Component | File(s) | Purpose |
|-----------|---------|---------|
| Flask API | `backend/app.py` | REST endpoints: `/health`, `/ocr`, `/generate`, `/generate/stream`, `/export` |
| OCR Engine | `backend/ocr_engine.py` | PaddleOCR wrapper — extracts text from images |
| Prompt Builder | `backend/prompt_builder.py`, `backend/prompts/` | Loads MCQ or short-answer template and compiles with OCR context |
| LLM Engine | `backend/llm_engine.py` | Loads Qwen2.5-0.5B GGUF via llama-cpp-python and runs inference |
| Validator | `backend/validator.py` | Parses, validates, and normalises LLM JSON output |
| Config | `backend/config.py` | Centralised configuration loaded from `.env` |
| PDF Exporter | `backend/pdf_export.py` | ReportLab-based PDF worksheet generator |
| React Native App | `frontend/` | Full Android application built with Expo SDK 57 |

---

## 4. Backend Documentation

### 4.1 API Endpoints

#### `GET /health`
Returns server status. Used by the app to check backend connectivity on the home screen.

**Response:**
```json
{ "status": "healthy", "api_version": "1.0.0", "timestamp": 1234567890 }
```

---

#### `POST /ocr`
Extracts text from an uploaded image using PaddleOCR.

**Request:** `multipart/form-data`
- `image` (file, required) — JPEG/PNG textbook page
- `lang` (string, optional, default: `"en"`) — OCR language code

**Response:**
```json
{
  "success": true,
  "full_text": "Newton's Second Law of Motion states that...",
  "lines": ["Newton's Second Law...", "F = m × a..."]
}
```

**Notes:**
- Images are processed entirely in memory — no temporary files written to disk
- Results are cached in memory by MD5 hash (up to 10 entries) — repeated uploads of the same image skip the OCR pipeline
- Images are pre-resized to a maximum of 1200px on the longest side before OCR for performance

---

#### `POST /generate`
Generates questions from OCR text. Waits for the full response before returning.

**Request body (JSON):**
```json
{
  "context_text": "...",
  "subject": "Physics",
  "difficulty": "Medium",
  "question_type": "mcq",
  "num_questions": 5,
  "session_id": "sess_abc123"
}
```

- `num_questions: 0` triggers automatic count selection based on content richness
- `difficulty: "Auto"` triggers automatic difficulty detection based on vocabulary complexity
- `session_id` is optional; one is generated if not provided

**Response:**
```json
{
  "success": true,
  "session_id": "sess_abc123",
  "questions": [
    {
      "question_text": "What does Newton's Second Law state?",
      "options": ["F = ma", "F = m/a", "a = m/F", "F = m+a"],
      "correct_answer": "F = ma",
      "explanation": "Newton's Second Law states that force equals mass times acceleration."
    }
  ]
}
```

---

#### `POST /generate/stream`
Same as `/generate` but uses Server-Sent Events (SSE) for real-time streaming. This is the endpoint used by the app.

**SSE Event types:**
- `progress` — `{ question_index: number, total: number }` — fired as each question is parsed
- `done` — `{ session_id: string, questions: Question[] }` — fired when the full question set is ready
- `error` — `{ error: string }` — fired on failure

---

#### `POST /export`
Generates a PDF worksheet from a session's saved questions.

**Request body (JSON):**
```json
{ "session_id": "sess_abc123" }
```

**Response:** Binary PDF file (`application/pdf`) as a file download.

---

### 4.2 LLM Engine (`llm_engine.py`)

The LLM engine loads and runs a quantised GGUF model locally via `llama-cpp-python`.

**Model:** `qwen2.5-0.5b-instruct-q4_k_m.gguf`
- Parameters: 0.5 billion
- Quantisation: 4-bit (Q4_K_M)
- File size: ~400 MB
- Location: `backend/data/models/`

**Inference configuration:**
- Context window: 4096 tokens
- Inference threads: 4
- Base temperature: 0.2 (increases slightly on retries, up to 0.8)
- Grammar-constrained generation via `LlamaGrammar` for strict JSON output

**Mock mode:** If the GGUF model file is not present, the engine automatically enters mock mode and generates keyword-based placeholder questions from the OCR context. This allows the full pipeline to be tested without a model file.

---

### 4.3 Prompt Engineering (`prompt_builder.py`, `prompts/`)

Two prompt templates are maintained in `backend/prompts/`:

- `mcq_template.txt` — generates multiple-choice questions with exactly 4 options
- `short_answer_template.txt` — generates short-answer questions with no options

Both use **ChatML format** (`<|im_start|>system ... <|im_end|>`) compatible with the Qwen instruction-tuned model family.

The OCR context is truncated to a maximum of **350 words** before being inserted into the prompt. This keeps the total prompt within the 4096-token context window while leaving sufficient budget for the full JSON output.

Key constraints enforced in both templates:
- JSON-only output — no markdown, no preamble, no extra text
- Questions must end with `?`
- MCQ distractors must be plausible and topically relevant
- No "all of the above" or "none of the above"
- `correct_answer` must match one option character-for-character

---

### 4.4 Output Validator (`validator.py`)

The validator handles three common failure modes in real LLM output:

1. **Markdown code fences** — strips ` ```json ... ``` ` wrappers before parsing
2. **Trailing garbage** — uses `json.JSONDecoder.raw_decode()` which stops at the first complete JSON object and ignores any text after it
3. **Option mismatches** — normalises `correct_answer` against the options list using case-insensitive, whitespace-collapsed comparison with substring fallback

For MCQ questions: if fewer than 4 options are returned, the validator pads to 4. If more than 4 are returned, it trims to 4.

---

### 4.5 Configuration (`config.py`, `.env`)

All runtime configuration is read from `backend/.env`. The relevant settings are:

```
HOST=0.0.0.0
PORT=5000
MODEL_PATH=data/models/qwen2.5-0.5b-instruct-q4_k_m.gguf
DATABASE_PATH=stem_qgen.db
OCR_LANG=en
```

The config loader is a custom plain-Python `.env` parser — no `python-dotenv` package is required.

---

## 5. Frontend Documentation

### 5.1 Technology Stack

| Item | Detail |
|------|--------|
| Framework | React Native with Expo SDK 57 |
| Language | TypeScript |
| Navigation | React Navigation — Stack + Bottom Tabs |
| State Management | Zustand (`useSettingsStore`, `useSessionStore`, `useAuthStore`) |
| Local Database | expo-sqlite (SQLite) |
| Camera | react-native-vision-camera |
| Image Picker | expo-image-picker |
| Font | Poppins (via @expo-google-fonts/poppins) |
| Icons | lucide-react-native |

---

### 5.2 Screen Reference

#### Onboarding Screen
Shown once on first launch. Introduces the app with feature highlights. Tapping "Get Started" marks onboarding complete (persisted in `useAuthStore`) and moves to the main app. This screen is never shown again after the first launch.

---

#### Home Screen
The main dashboard. Displays:
- Backend connectivity status banner (live health check on every focus)
- Session statistics: total sessions, average score, best score, top subject
- Quick action buttons: New Quiz, History, Settings, Export
- "Generate Quiz" and "Review History" CTA cards
- Settings icon in the header

---

#### Capture Screen
Entry point for creating a new quiz. The **quiz configuration sheet opens automatically** on every visit so the user sets subject, difficulty, format, and question count before scanning.

Three input paths:
1. **Live camera** — VisionCamera viewfinder with a shutter button
2. **Gallery upload** — `expo-image-picker` selects an image from the device
3. **Simulate scan** — injects a sample textbook passage for testing without a real image

After input, the screen runs OCR, streams question generation, saves to local SQLite, and navigates to the Question Screen.

Recent OCR results are cached locally via `ocrCacheRepository` and available in a "Recent Scans" panel for quick re-generation without re-uploading.

---

#### Question Screen
Presents one question at a time with previous/next navigation. For MCQ, options are shown as tappable cards with immediate visual feedback. For short-answer, the correct answer is revealed on tap. Student answers are tracked locally. On the final question, navigates to the Results Screen.

---

#### Results Screen
Displays a performance report containing:
- Score hero card with a tier label (Mastery / Competent / Needs Practice) based on percentage
- Correct, wrong, and total counts with a progress bar
- "Export PDF" button — calls `/export` and shares the resulting file via the native Android share sheet
- "Regenerate Questions" button — re-runs generation on the same OCR context
- Paginated review of all questions with correct/incorrect indicators

---

#### History Screen
Lists all past sessions from local SQLite, sorted by date. Each card shows subject, difficulty, date, a context preview, and score. Tapping a session reopens its Results Screen. Sessions can be deleted with a confirmation prompt.

---

#### Settings Screen
Configures the backend URL. Includes guidance for Android emulator users (`http://10.0.2.2:5000`). Quiz preferences (subject, difficulty, format, count) are configured on the Capture Screen.

---

### 5.3 Navigation Structure

```
Auth Stack (first launch only)
└── Onboarding

Main Stack (after onboarding)
└── MainTabs (Bottom Tab Navigator)
    ├── Home
    └── History

    Modal screens (pushed on top of tabs)
    ├── Settings
    ├── Capture
    ├── Question
    └── Results
```

---

### 5.4 Local Database

The frontend maintains its own SQLite database via `expo-sqlite` for offline session history, independent of the backend database.

**Repositories:**
- `sessionRepository.ts` — CRUD operations for sessions
- `questionRepository.ts` — CRUD for questions and student answer records
- `ocrCacheRepository.ts` — caches recent OCR text results by image hash for quick re-use

---

## 6. Data Flow

### Full generation flow (gallery upload path)

```
1. User navigates to Capture Screen
   → Quiz config sheet auto-opens
   → User sets subject, difficulty, format, count
   → Taps "Done — Ready to Scan"

2. User taps "Upload from Gallery"
   → expo-image-picker returns image URI

3. App sends image to POST /ocr
   → Backend: PaddleOCR extracts text from image
   ← Returns { full_text, lines }

4. App sends text to POST /generate/stream
   Request: { context_text, subject, difficulty, question_type, num_questions }

5. Backend pipeline:
   a. PromptBuilder truncates context to 350 words, loads template
   b. LlmEngine runs Qwen2.5-0.5B GGUF inference (grammar-constrained)
   c. Tokens stream back via SSE as they are produced
   d. Validator parses, validates, and normalises JSON on stream completion
   e. Session and questions saved to backend SQLite (stem_qgen.db)
   f. SSE "done" event fires with the complete question list

6. App receives "done" event
   → Saves session and questions to frontend SQLite
   → Navigates to Question Screen

7. User answers all questions
   → Student answers recorded in local SQLite

8. User reaches the last question → navigates to Results Screen
   → Score computed from local answer records
   → Export PDF calls POST /export
   → Binary PDF returned and shared via native Android share sheet
```

---

## 7. Database Schema

### Backend (`stem_qgen.db`)

```sql
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    subject     TEXT NOT NULL,
    difficulty  TEXT NOT NULL,
    raw_context TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
    id             TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL,
    question_text  TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation    TEXT,
    options_json   TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE answers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    question_id TEXT NOT NULL,
    user_answer TEXT,
    is_correct  INTEGER DEFAULT 0,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id)  REFERENCES sessions(id)  ON DELETE CASCADE,
    FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
);
```

`options_json` stores a JSON array of option strings for MCQ questions, and is `NULL` for short-answer questions.

Indexes are created at startup on `questions.session_id`, `answers.session_id`, `answers.question_id`, and `sessions.created_at DESC` for query performance.

---

## 8. Setup and Deployment Guide

### 8.1 Backend Setup

**Requirements:** Python 3.11, the project repository cloned locally.

```bash
# Navigate to the backend folder
cd backend

# Activate the virtual environment (Git Bash on Windows)
source .venv311/Scripts/activate

# Start the server
python app.py
```

The server starts on `0.0.0.0:5000`. On first startup it will:
- Create `stem_qgen.db` with all tables and indexes
- Warm up the PaddleOCR engine (downloads model files on first run if not cached)
- Load the Qwen2.5-0.5B GGUF model from `data/models/`

**Finding your laptop's IP address** (needed to connect the phone):
```bash
ipconfig    # Windows — look for IPv4 Address under your Wi-Fi adapter
```

---

### 8.2 Frontend Setup

**Requirements:** Node.js 18+

```bash
cd frontend
npm install
npx expo run:android      # local debug build
# or
eas build --profile preview --platform android   # cloud APK build
```

In the app **Settings screen**, set the backend URL to your laptop's IP:
```
http://192.168.x.x:5000
```

Both the phone and the laptop must be connected to the same Wi-Fi network.

---

### 8.3 Environment Variables (`backend/.env`)

```
HOST=0.0.0.0
PORT=5000
```

All other entries are optional and not required for offline operation.

---

## 9. Known Limitations

| # | Limitation | Impact |
|---|-----------|--------|
| 1 | Question depth is limited by the 0.5B model size | Medium — the model handles factual recall and definition questions well but may produce shallower questions on highly complex or abstract topics |
| 2 | OCR accuracy degrades on blurry, low-contrast, or heavily angled photos | Medium — users should hold the camera steady with good lighting for best results |
| 3 | Both phone and laptop must be on the same Wi-Fi network | Medium — by design; requires a Wi-Fi router or mobile hotspot at the point of use |
| 4 | Android build requires internet access the first time to download Gradle dependencies | Low — a one-time developer setup step; the installed APK itself is fully offline |
| 5 | PDF export requires the backend to be reachable at time of export | Low — session history and scores remain accessible in the app even if the backend is offline |
