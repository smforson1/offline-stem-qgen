// Owner: S3 | Purpose: Zustand store — active session state and question list

import { create } from 'zustand';
import { Session } from '../types/Session';
import { Question } from '../types/Question';

interface SessionState {
  activeSession: Session | null;
  questions: Question[];
  currentQuestionIndex: number;
  userAnswers: Record<number, string>; // Maps question index to student's answer string
  isGenerating: boolean;
  generationStep: string; // E.g., 'Uploading image...', 'Running OCR...', 'Compiling questions...'
  error: string | null;
  startSession: (session: Session, questions: Question[]) => void;
  selectAnswer: (questionIndex: number, answer: string) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setGenerating: (generating: boolean, step?: string) => void;
  setError: (error: string | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  questions: [],
  currentQuestionIndex: 0,
  userAnswers: {},
  isGenerating: false,
  generationStep: '',
  error: null,

  startSession: (session, questions) => set({
    activeSession: session,
    questions,
    currentQuestionIndex: 0,
    userAnswers: {},
    error: null,
  }),

  selectAnswer: (questionIndex, answer) => set((state) => ({
    userAnswers: {
      ...state.userAnswers,
      [questionIndex]: answer,
    },
  })),

  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),

  setGenerating: (generating, step = '') => set({
    isGenerating: generating,
    generationStep: step,
  }),

  setError: (error) => set({ error }),

  clearSession: () => set({
    activeSession: null,
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: {},
    error: null,
  }),
}));
