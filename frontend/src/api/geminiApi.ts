// Owner: S3 | Purpose: Gemini API client — used when internet is available as a faster alternative to local LLM

import { Question } from '../types/Question';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface GeminiGenerateResult {
  success: boolean;
  questions: Question[];
  error?: string;
}

/**
 * Builds the prompt for Gemini text-only mode (OCR already done locally).
 */
function buildGeminiPrompt(
  contextText: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  numQuestions: number,
): string {
  const truncated = contextText.split(/\s+/).slice(0, 400).join(' ');
  return buildQuestionPrompt(truncated, subject, difficulty, questionType, numQuestions);
}

/**
 * Builds the prompt text used in both text and vision modes.
 */
function buildQuestionPrompt(
  contextText: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  numQuestions: number,
): string {
  if (questionType === 'mcq') {
    return `You are a STEM question generator. Output ONLY a valid JSON object with no markdown, no explanation, no code fences.

Subject: ${subject}
Difficulty: ${difficulty}
Number of questions: ${numQuestions}

Generate ${numQuestions} multiple-choice questions based ONLY on the textbook content below.
All questions MUST be framed within the context of ${subject}.

Rules:
1. question_text must end with "?" — never a statement.
2. Exactly 4 options, each with full answer text (never single letters).
3. correct_answer must match one option EXACTLY (character-for-character).
4. Distractors must be plausible, distinct, and similar in length to the correct answer.
5. Do not repeat the question text in any option.
6. explanation: 1-3 sentences on why the answer is correct.

JSON format:
{"questions":[{"question_text":"...","options":["...","...","...","..."],"correct_answer":"exact option text","explanation":"..."}]}

TEXTBOOK CONTENT:
${contextText}`;
  } else {
    return `You are a STEM question generator. Output ONLY a valid JSON object with no markdown, no explanation, no code fences.

Subject: ${subject}
Difficulty: ${difficulty}
Number of questions: ${numQuestions}

Generate ${numQuestions} short-answer questions based ONLY on the textbook content below.
All questions MUST be framed within the context of ${subject}.

Rules:
1. question_text must end with "?" — never a statement.
2. correct_answer must be concise: a word, phrase, or 1-2 sentences.
3. explanation: 1-3 sentences justifying the correct answer.
4. No options.

JSON format:
{"questions":[{"question_text":"...","options":null,"correct_answer":"...","explanation":"..."}]}

TEXTBOOK CONTENT:
${contextText}`;
  }
}

/**
 * Parses the raw Gemini response text into a validated Question array.
 */
function parseGeminiResponse(rawText: string, questionType: 'mcq' | 'short_answer'): Question[] {
  // Strip markdown fences if present
  let text = rawText.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Find first { and parse from there
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON found in Gemini response');

  const data = JSON.parse(text.slice(start));
  const questions: Question[] = [];

  for (const q of data.questions || []) {
    if (!q.question_text || !q.correct_answer || !q.explanation) continue;

    if (questionType === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) continue;
      // Ensure correct_answer matches one of the options
      const opts: string[] = q.options.slice(0, 4).map((o: string) => String(o).trim());
      while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
      const correctTrimmed = String(q.correct_answer).trim();
      const matched = opts.find(
        (o) => o.toLowerCase() === correctTrimmed.toLowerCase()
      ) || opts[0];
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

  if (questions.length === 0) throw new Error('Gemini returned no valid questions');
  return questions;
}

/**
 * Generates STEM questions using the Gemini API from plain text.
 * Called when OCR has already been done locally.
 */
export const generateWithGemini = async (
  contextText: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  numQuestions: number,
  apiKey: string,
  onProgress?: (index: number, total: number) => void,
): Promise<GeminiGenerateResult> => {
  if (!apiKey || apiKey.trim() === '') {
    return { success: false, questions: [], error: 'No Gemini API key set. Add it in Settings.' };
  }

  const prompt = buildGeminiPrompt(contextText, subject, difficulty, questionType, numQuestions);

  try {
    onProgress?.(0, numQuestions);
    const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey.trim()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 150 + numQuestions * 200 },
      }),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return { success: false, questions: [], error: `Gemini API error ${response.status}: ${errBody.slice(0, 200)}` };
    }
    const body = await response.json();
    const rawText: string = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!rawText) return { success: false, questions: [], error: 'Gemini returned an empty response.' };
    onProgress?.(numQuestions, numQuestions);
    const questions = parseGeminiResponse(rawText, questionType);
    return { success: true, questions };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { success: false, questions: [], error: 'Gemini request timed out.' };
    return { success: false, questions: [], error: e?.message || 'Unknown Gemini error' };
  }
};

/**
 * Vision mode — sends the image directly to Gemini, skipping PaddleOCR entirely.
 * Gemini reads the textbook page AND generates questions in a single API call.
 * This is dramatically faster than OCR → local LLM when online.
 *
 * @param imageUri  Local file URI (file:// or content://) from camera or gallery
 */
export const generateFromImageWithGemini = async (
  imageUri: string,
  subject: string,
  difficulty: string,
  questionType: 'mcq' | 'short_answer',
  numQuestions: number,
  apiKey: string,
  onProgress?: (index: number, total: number) => void,
): Promise<GeminiGenerateResult> => {
  if (!apiKey || apiKey.trim() === '') {
    return { success: false, questions: [], error: 'No Gemini API key set.' };
  }

  try {
    onProgress?.(0, numQuestions);

    // Read image as base64
    const RNFS = require('react-native-fs');
    let base64: string;
    let mimeType = 'image/jpeg';

    if (imageUri.startsWith('content://')) {
      // Android content URI — copy to temp file first, then read
      const tmpPath = `${RNFS.CachesDirectoryPath}/gemini_upload_${Date.now()}.jpg`;
      await RNFS.copyFile(imageUri, tmpPath);
      base64 = await RNFS.readFile(tmpPath, 'base64');
      await RNFS.unlink(tmpPath).catch(() => {});
    } else {
      const path = imageUri.replace('file://', '');
      base64 = await RNFS.readFile(path, 'base64');
      if (imageUri.toLowerCase().endsWith('.png')) mimeType = 'image/png';
    }

    const questionPrompt = buildQuestionPrompt(
      'the textbook page shown in the image',
      subject, difficulty, questionType, numQuestions,
    );

    const response = await fetch(`${GEMINI_API_BASE}?key=${apiKey.trim()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: questionPrompt },
          ],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 150 + numQuestions * 200 },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return { success: false, questions: [], error: `Gemini vision error ${response.status}: ${errBody.slice(0, 200)}` };
    }

    const body = await response.json();
    const rawText: string = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!rawText) return { success: false, questions: [], error: 'Gemini vision returned empty response.' };

    onProgress?.(numQuestions, numQuestions);
    const questions = parseGeminiResponse(rawText, questionType);
    return { success: true, questions };

  } catch (e: any) {
    if (e?.name === 'AbortError') return { success: false, questions: [], error: 'Gemini vision request timed out.' };
    return { success: false, questions: [], error: e?.message || 'Unknown Gemini vision error' };
  }
};
