// Owner: S3 | Purpose: Hybrid OCR Service — runs on-device Google ML Kit first with automatic backend fallback

import { uploadImageForOcr, OcrResponse } from './ocrApi';

export interface OcrResult {
  success: boolean;
  full_text: string;
  source: 'on_device' | 'backend';
  error?: string;
}

/**
 * Attempts on-device OCR using Google ML Kit.
 * If ML Kit native module is not available or fails, seamlessly falls back
 * to the backend /ocr endpoint.
 */
export const recognizeText = async (
  imageUri: string,
  lang: string = 'en'
): Promise<OcrResult> => {
  // 1. Try On-Device Native ML Kit
  try {
    // Dynamically require to avoid crash if native binary is not bundled in current environment
    const mlkit = require('@react-native-ml-kit/text-recognition');
    const TextRecognition = mlkit.default || mlkit;

    if (TextRecognition && typeof TextRecognition.recognize === 'function') {
      const formattedUri = imageUri.startsWith('file://') || imageUri.startsWith('content://')
        ? imageUri
        : `file://${imageUri}`;

      const result = await TextRecognition.recognize(formattedUri);

      if (result && result.text && result.text.trim().length > 0) {
        return {
          success: true,
          full_text: result.text.trim(),
          source: 'on_device',
        };
      }
    }
  } catch (nativeErr: any) {
    // Native ML Kit not linked or failed — silently proceed to backend fallback
    console.log('On-device ML Kit unavailable, falling back to backend OCR:', nativeErr?.message);
  }

  // 2. Fallback to Backend OCR Endpoint
  try {
    const backendRes: OcrResponse = await uploadImageForOcr(imageUri, lang);
    if (backendRes.success && backendRes.full_text) {
      return {
        success: true,
        full_text: backendRes.full_text,
        source: 'backend',
      };
    }
    return {
      success: false,
      full_text: '',
      source: 'backend',
      error: backendRes.error || 'Failed to extract text from image.',
    };
  } catch (backendErr: any) {
    return {
      success: false,
      full_text: '',
      source: 'backend',
      error: backendErr?.message || 'OCR processing failed.',
    };
  }
};
