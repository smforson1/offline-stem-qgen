// Owner: S3 | Purpose: TypeScript interface for a capture/generation Session

import { Question } from './Question';

export interface Session {
  id: string;
  subject: string;
  difficulty: string;
  raw_context: string;
  created_at: string;
  questions?: Question[];
  average_score?: number; // percentage or fraction of correct answers
}
