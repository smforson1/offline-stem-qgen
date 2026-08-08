// Owner: S3 | Purpose: Online AI client — uses Groq (free, fast) when internet is available
// Groq runs Llama 3.2 Vision on custom hardware — typically 2-5s for 5 questions
// Get a free API key at: https://console.groq.com

import RNFS from 'react-native-fs';
import { Question } from '../types/Question';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'; // supports vision + text
const TEXT_MODEL = 'llama-3.3-70b-versatile'; // text-only fallback, very fast

export interface OnlineGenerateResult {
  success: boolean;
  questions: Question[];
  error?: string;
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(
  contextText: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  numQuestions: number,
): string {
  const base = `You are a STEM question generator. Output ONLY a valid JSON object — no markdown, no explanation, no code fences.

Subject: ${subject}
Difficulty: ${difficulty}
Number of questions: ${numQuestions}

Generate ${numQuestions} ${questionType === 'mcq' ? 'multiple-choice' : 'short-answer'} questions based ONLY on the textbook content. Frame all questions within ${subject}.`;

  if (questionType === 'mcq') {
    return `${base}

Rules:
1. question_text must end with "?".
2. Exactly 4 options with full answer text (no single letters).
3. correct_answer must match one option EXACTLY.
4. Distractors must be plausible and distinct.
5. explanation: 1-3 sentences.

JSON: {"questions":[{"question_text":"...","options":["...","...","...","..."],"correct_answer":"exact option text","explanation":"..."}]}

CONTENT:
${contextText}`;
  } else {
    return `${base}

Rules:
1. question_text must end with "?".
2. correct_answer: concise word/phrase/1-2 sentences.
3. explanation: 1-3 sentences.
4. options must be null.

JSON: {"questions":[{"question_text":"...","options":null,"correct_answer":"...","explanation":"..."}]}

CONTENT:
${contextText}`;
  }
}

// ── Response parser ────────────────────────────────────────────────────────────

function parseResponse(rawText: string, questionType: 'mcq' | 'short_answer'): Question[] {
  let text = rawText.trim();

  // Strip markdown fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Extract JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in response');
  const data = JSON.parse(text.slice(start, end + 1));

  const questions: Question[] = [];
  for (const q of data.questions || []) {
    if (!q.question_text || !q.correct_answer || !q.explanation) continue;
    if (questionType === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) continue;
      const opts: string[] = q.options.slice(0, 4).map((o: string) => String(o).trim());
      while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
      const correctTrimmed = String(q.correct_answer).trim();
      const matched = opts.find((o) => o.toLowerCase() === correctTrimmed.toLowerCase()) || opts[0];
      questions.push({
        question_text: String(q.question_text).trim(),
        options: opts,
        correct_answer: matched,
        explanation: String(q.explanation).trim(),
      });
    } else {
      questions.push({
        question_text: String(q.question_text).trim(),
        options: null,
        correct_answer: String(q.correct_answer).trim(),
        explanation: String(q.explanation).trim(),
      });
    }
  }

  if (questions.length === 0) throw new Error('No valid questions in response');
  return questions;
}

// ── Groq API call helper ───────────────────────────────────────────────────────

async function callGroq(
  messages: object[],
  apiKey: string,
  model: string,
  numQuestions: number,
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 150 + numQuestions * 220,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Groq API error ${response.status}: ${errBody.slice(0, 300)}`);
  }

  const body = await response.json();
  const text: string = body?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Groq returned empty response');
  return text;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generates questions from an image using Groq vision (Llama 4 Scout).
 * No OCR needed — image goes directly to the model.
 */
export const generateFromImageOnline = async (
  imageUri: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  numQuestions: number,
  apiKey: string,
  onProgress?: (index: number, total: number) => void,
): Promise<OnlineGenerateResult> => {
  if (!apiKey?.trim()) {
    return { success: false, questions: [], error: 'No API key set. Add your Groq key in Settings.' };
  }

  try {
    onProgress?.(0, numQuestions);

    // Read image as base64
    let base64: string;
    let mimeType = 'image/jpeg';
    const tmpPath = `${RNFS.CachesDirectoryPath}/groq_upload_${Date.now()}.jpg`;

    if (imageUri.startsWith('content://')) {
      await RNFS.copyFile(imageUri, tmpPath);
      base64 = await RNFS.readFile(tmpPath, 'base64');
      await RNFS.unlink(tmpPath).catch(() => {});
    } else {
      const path = imageUri.replace('file://', '');
      base64 = await RNFS.readFile(path, 'base64');
      if (imageUri.toLowerCase().endsWith('.png')) mimeType = 'image/png';
    }

    const prompt = buildPrompt(
      'the textbook page shown in the image',
      subject, difficulty, questionType, numQuestions,
    );

    const messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: 'text', text: prompt },
      ],
    }];

    const rawText = await callGroq(messages, apiKey, VISION_MODEL, numQuestions);
    onProgress?.(numQuestions, numQuestions);
    const questions = parseResponse(rawText, questionType);
    return { success: true, questions };

  } catch (e: any) {
    if (e?.name === 'AbortError') return { success: false, questions: [], error: 'Request timed out.' };
    return { success: false, questions: [], error: e?.message || 'Unknown error' };
  }
};

/**
 * Generates questions from plain text using Groq (text-only, even faster).
 * Used when OCR text is already available (e.g. from the Recent Scans cache).
 */
export const generateFromTextOnline = async (
  contextText: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  numQuestions: number,
  apiKey: string,
  onProgress?: (index: number, total: number) => void,
): Promise<OnlineGenerateResult> => {
  if (!apiKey?.trim()) {
    return { success: false, questions: [], error: 'No API key set. Add your Groq key in Settings.' };
  }

  try {
    onProgress?.(0, numQuestions);
    const truncated = contextText.split(/\s+/).slice(0, 400).join(' ');
    const prompt = buildPrompt(truncated, subject, difficulty, questionType, numQuestions);
    const messages = [{ role: 'user', content: prompt }];
    const rawText = await callGroq(messages, apiKey, TEXT_MODEL, numQuestions);
    onProgress?.(numQuestions, numQuestions);
    const questions = parseResponse(rawText, questionType);
    return { success: true, questions };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { success: false, questions: [], error: 'Request timed out.' };
    return { success: false, questions: [], error: e?.message || 'Unknown error' };
  }
};
