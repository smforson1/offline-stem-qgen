// Owner: S3 | Purpose: CRUD helpers for the "questions" and "answers" tables

import type SQLite from 'react-native-sqlite-storage';
import { getDB } from './database';
import { Question } from '../types/Question';

export const questionRepository = {
  /**
   * Saves a list of questions associated with a session ID.
   */
  saveQuestions: async (questions: Question[], sessionId: string): Promise<void> => {
    const db = await getDB();
    
    // Execute inside a single transaction to maintain atomicity and performance
    await db.transaction(async (tx: any) => {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qId = q.id || `q_${sessionId}_${i}`;
        const optionsJson = q.options ? JSON.stringify(q.options) : null;

        await tx.executeSql(
          `INSERT OR REPLACE INTO questions (id, session_id, question_text, correct_answer, explanation, options_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [qId, sessionId, q.question_text, q.correct_answer, q.explanation, optionsJson]
        );
      }
    });
  },

  /**
   * Retrieves all questions associated with a session ID.
   */
  getQuestionsBySession: async (sessionId: string): Promise<Question[]> => {
    const db = await getDB();
    const [results] = await db.executeSql(
      'SELECT * FROM questions WHERE session_id = ?',
      [sessionId]
    );

    const questions: Question[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const item = results.rows.item(i);
      let options: string[] | null = null;
      
      if (item.options_json) {
        try {
          options = JSON.parse(item.options_json);
        } catch (e) {
          console.error('Failed to parse options_json:', e);
        }
      }

      questions.push({
        id: item.id,
        question_text: item.question_text,
        correct_answer: item.correct_answer,
        explanation: item.explanation,
        options,
      });
    }
    return questions;
  },

  /**
   * Saves the student's selected answers for a completed session.
   */
  saveStudentAnswers: async (
    answers: { questionId: string; selectedAnswer: string; isCorrect: boolean }[],
    sessionId: string
  ): Promise<void> => {
    const db = await getDB();
    
    await db.transaction(async (tx: any) => {
      for (const ans of answers) {
        const ansId = `ans_${sessionId}_${ans.questionId}`;
        await tx.executeSql(
          `INSERT OR REPLACE INTO answers (id, session_id, question_id, selected_answer, is_correct)
           VALUES (?, ?, ?, ?, ?)`,
          [ansId, sessionId, ans.questionId, ans.selectedAnswer, ans.isCorrect ? 1 : 0]
        );
      }
    });
  },

  /**
   * Retrieves student answers for a session, returning a dictionary indexed by questionId.
   */
  getStudentAnswersBySession: async (
    sessionId: string
  ): Promise<Record<string, { selectedAnswer: string; isCorrect: boolean }>> => {
    const db = await getDB();
    const [results] = await db.executeSql(
      'SELECT * FROM answers WHERE session_id = ?',
      [sessionId]
    );

    const answersMap: Record<string, { selectedAnswer: string; isCorrect: boolean }> = {};
    for (let i = 0; i < results.rows.length; i++) {
      const item = results.rows.item(i);
      answersMap[item.question_id] = {
        selectedAnswer: item.selected_answer,
        isCorrect: item.is_correct === 1,
      };
    }
    return answersMap;
  },
};
