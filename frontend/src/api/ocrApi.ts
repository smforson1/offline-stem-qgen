// Owner: S3 | Purpose: API call — POST image to /ocr endpoint

import apiClient from './client';

export interface OcrResponse {
  success: boolean;
  full_text: string;
  lines: Array<{
    text: string;
    confidence: number;
    box: number[][];
  }>;
  error?: string;
}

/**
 * Uploads a local photo to the backend /ocr endpoint for text extraction.
 */
export const uploadImageForOcr = async (
  imageUri: string,
  lang: string = 'en'
): Promise<OcrResponse> => {
  const formData = new FormData();
  const filename = imageUri.split('/').pop()?.split('?')[0] || `upload_${Date.now()}.jpg`;

  // Normalise URI — on Android, gallery picker returns content:// URIs.
  // React Native's FormData handles both file:// and content:// but the
  // type must always be set explicitly or some Android versions drop the body.
  const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: mimeType,
  } as any);
  
  formData.append('lang', lang);

  const response = await apiClient.post<OcrResponse>('/ocr', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    // OCR can take 60-90s on first run — override the global timeout for this call
    timeout: 300000,
  });

  return response.data;
};
