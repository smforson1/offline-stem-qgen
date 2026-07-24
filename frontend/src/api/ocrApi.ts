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
  const filename = imageUri.split('/').pop() || `upload_${Date.now()}.jpg`;

  // React Native FormData upload schema requires mapping file details as an object
  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: 'image/jpeg',
  } as any);
  
  formData.append('lang', lang);

  const response = await apiClient.post<OcrResponse>('/ocr', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};
