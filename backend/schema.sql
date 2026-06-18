-- Owner: S4 | Purpose: SQLite schema — tables for sessions, questions, answers, and exports

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    raw_context TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    options_json TEXT, -- JSON string array representing choices if multiple choice, NULL if open-ended
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
