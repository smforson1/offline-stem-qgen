// Owner: S3 | Purpose: TypeScript interfaces for Question, Answer, and QuestionSet

export interface Question {
  id?: string;
  question_text: string;
  options?: string[] | null; // Null/undefined for open-ended/short-answers
  correct_answer: string;
  explanation: string;
}

export interface UserAnswer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timestamp: string;
}

export interface QuestionSet {
  sessionId: string;
  subject: string;
  difficulty: string;
  questions: Question[];
}
