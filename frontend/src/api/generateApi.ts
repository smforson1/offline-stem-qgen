// Owner: S3 | Purpose: API call — POST OCR text to /generate endpoint

import apiClient from './client';
import { useSettingsStore } from '../store/useSettingsStore';
import { Question } from '../types/Question';

export interface GenerateResponse {
  success: boolean;
  session_id: string;
  questions: Question[];
  error?: string;
}

/**
 * Triggers AI question generation using OCR text on the local server.
 * Non-streaming version — waits for the full response before returning.
 */
export const generateQuestions = async (
  contextText: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  sessionId?: string,
  numQuestions?: number,
): Promise<GenerateResponse> => {
  const response = await apiClient.post<GenerateResponse>('/generate', {
    context_text: contextText,
    subject,
    difficulty,
    question_type: questionType,
    session_id: sessionId,
    num_questions: numQuestions,
  });
  
  return response.data;
};

export interface StreamProgressEvent {
  question_index: number;
  total: number;
}

export interface StreamDoneEvent {
  session_id: string;
  questions: Question[];
}

/**
 * Streaming version of question generation.
 *
 * Uses a plain fetch + ReadableStream to consume the SSE endpoint
 * (/generate/stream) so the UI can react as each question is parsed,
 * rather than waiting for the full model output.
 *
 * @param onProgress  Called each time the server reports another complete question
 * @param onDone      Called once with the full parsed question list and session id
 * @param onError     Called if the server or network reports a failure
 */
export const generateQuestionsStream = async (
  contextText: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  numQuestions: number,
  onProgress: (event: StreamProgressEvent) => void,
  onDone: (event: StreamDoneEvent) => void,
  onError: (message: string) => void,
  sessionId?: string,
): Promise<void> => {
  const { apiUrl } = useSettingsStore.getState();
  const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  const url = `${base}/generate/stream`;

  // Allow 5 minutes — OCR + LLM on CPU can be slow on first run
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        context_text: contextText,
        subject,
        difficulty,
        question_type: questionType,
        num_questions: numQuestions,
        session_id: sessionId,
      }),
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e?.name === 'AbortError') {
      onError('Request timed out. The server is taking too long — try fewer questions or a shorter text.');
    } else {
      onError(`Network error: ${e.message || 'Could not reach server'}`);
    }
    return;
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    onError(`Server error: ${response.status} ${response.statusText}`);
    return;
  }

  // React Native's fetch supports getReader() on the response body
  const reader = response.body?.getReader();
  if (!reader) {
    clearTimeout(timeoutId);
    onError('Streaming not supported in this environment.');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let lastProgressIndex = 0;
  let gotDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const messages = buffer.split('\n\n');
      buffer = messages.pop() ?? '';

      for (const message of messages) {
        const lines = message.trim().split('\n');
        let eventType = 'message';
        let dataLine = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice('event:'.length).trim();
          } else if (line.startsWith('data:')) {
            dataLine = line.slice('data:'.length).trim();
          }
        }

        if (!dataLine) continue;

        try {
          const payload = JSON.parse(dataLine);

          if (eventType === 'progress') {
            if (payload.question_index > lastProgressIndex) {
              lastProgressIndex = payload.question_index;
              onProgress(payload as StreamProgressEvent);
            }
          } else if (eventType === 'done') {
            gotDone = true;
            clearTimeout(timeoutId);
            onDone(payload as StreamDoneEvent);
            reader.cancel();
            return;
          } else if (eventType === 'error') {
            clearTimeout(timeoutId);
            onError(payload.error || 'Unknown server error');
            reader.cancel();
            return;
          }
        } catch {
          // Malformed SSE data — skip
        }
      }
    }
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (!gotDone) {
      onError(`Stream interrupted: ${e.message || 'Connection lost mid-generation'}`);
    }
    return;
  }

  clearTimeout(timeoutId);
  // Stream ended without a done event — fall back to non-streaming endpoint
  if (!gotDone) {
    try {
      onProgress({ question_index: 0, total: numQuestions });
      const fallback = await apiClient.post<GenerateResponse>('/generate', {
        context_text: contextText,
        subject,
        difficulty,
        question_type: questionType,
        num_questions: numQuestions,
        session_id: sessionId,
      });
      if (fallback.data.success && fallback.data.questions?.length > 0) {
        onDone({ session_id: fallback.data.session_id, questions: fallback.data.questions });
      } else {
        onError(fallback.data.error || 'Generation failed with no questions returned.');
      }
    } catch (e: any) {
      onError(`Generation failed: ${e.message || 'Check server connection.'}`);
    }
  }
};
