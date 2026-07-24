// Owner: S3 | Purpose: API call — POST OCR text to /generate endpoint

import apiClient from './client';
import { Question } from '../types/Question';

export interface GenerateResponse {
  success: boolean;
  session_id: string;
  questions: Question[];
  error?: string;
}

/**
 * Triggers AI question generation using OCR text on the local server.
 */
export const generateQuestions = async (
  contextText: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  sessionId?: string
): Promise<GenerateResponse> => {
  const response = await apiClient.post<GenerateResponse>('/generate', {
    context_text: contextText,
    subject,
    difficulty,
    question_type: questionType,
    session_id: sessionId,
  });
  
  return response.data;
};
