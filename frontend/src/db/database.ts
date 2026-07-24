// Owner: S3 | Purpose: react-native-sqlite-storage initialisation and connection singleton

import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let dbInstance: SQLite.SQLiteDatabase | null = null;

// Table creation script
const initTables = async (db: SQLite.SQLiteDatabase) => {
  try {
    // 1. Sessions table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        raw_context TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Questions table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        options_json TEXT, -- JSON array string
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    // 3. Student answers table (referred to as "answers")
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS answers (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        selected_answer TEXT NOT NULL,
        is_correct INTEGER NOT NULL, -- 0 for false, 1 for true
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
      );
    `);
    
    console.log('Local SQLite database schemas initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
    throw error;
  }
};

export const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await SQLite.openDatabase({
      name: 'local_stem_qgen.db',
      location: 'default',
    });
    
    await initTables(dbInstance);
    return dbInstance;
  } catch (error) {
    console.error('Failed to open SQLite database connection:', error);
    throw error;
  }
};
