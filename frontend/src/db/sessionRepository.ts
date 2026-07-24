// Owner: S3 | Purpose: CRUD helpers for the "sessions" table

import { getDB } from './database';
import { Session } from '../types/Session';

export const sessionRepository = {
  /**
   * Inserts a new session record or updates if it already exists.
   */
  saveSession: async (session: Session): Promise<void> => {
    const db = await getDB();
    await db.executeSql(
      `INSERT OR REPLACE INTO sessions (id, subject, difficulty, raw_context, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        session.id,
        session.subject,
        session.difficulty,
        session.raw_context,
        session.created_at || new Date().toISOString(),
      ]
    );
  },

  /**
   * Fetches all session records along with their cached average scores.
   */
  getSessions: async (): Promise<Session[]> => {
    const db = await getDB();
    // Enable foreign keys for safety
    await db.executeSql('PRAGMA foreign_keys = ON;');
    
    const [results] = await db.executeSql(
      `SELECT s.*, 
       (SELECT COUNT(*) FROM questions WHERE session_id = s.id) as total_questions,
       (SELECT SUM(is_correct) FROM answers WHERE session_id = s.id) as correct_answers
       FROM sessions s 
       ORDER BY s.created_at DESC`
    );

    const sessions: Session[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const item = results.rows.item(i);
      const total = item.total_questions || 0;
      const correct = item.correct_answers || 0;
      const average_score = total > 0 ? (correct / total) * 100 : undefined;

      sessions.push({
        id: item.id,
        subject: item.subject,
        difficulty: item.difficulty,
        raw_context: item.raw_context,
        created_at: item.created_at,
        average_score,
      });
    }
    return sessions;
  },

  /**
   * Fetches a session by its unique ID.
   */
  getSessionById: async (id: string): Promise<Session | null> => {
    const db = await getDB();
    const [results] = await db.executeSql(
      'SELECT * FROM sessions WHERE id = ?',
      [id]
    );

    if (results.rows.length > 0) {
      const item = results.rows.item(0);
      return {
        id: item.id,
        subject: item.subject,
        difficulty: item.difficulty,
        raw_context: item.raw_context,
        created_at: item.created_at,
      };
    }
    return null;
  },

  /**
   * Deletes a session and cascading question/answer lists from the local db.
   */
  deleteSession: async (id: string): Promise<void> => {
    const db = await getDB();
    await db.executeSql('PRAGMA foreign_keys = ON;');
    await db.executeSql('DELETE FROM sessions WHERE id = ?', [id]);
  },
};
