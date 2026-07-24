// Owner: S3 | Purpose: API call — GET /export/:sessionId to download PDF

import apiClient from './client';
import RNFS from 'react-native-fs';

/**
 * Converts an ArrayBuffer to a base64 string safely in React Native.
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Calls the backend export endpoint, gets the PDF binary, and saves it locally.
 * Returns the local file path to the saved PDF.
 */
export const downloadPdfExport = async (sessionId: string, subject: string = 'STEM'): Promise<string> => {
  try {
    const response = await apiClient.post('/export', { session_id: sessionId }, {
      responseType: 'arraybuffer',
    });

    const base64Data = arrayBufferToBase64(response.data);
    const sanitizedSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Save to the document directory on device
    const filePath = `${RNFS.DocumentDirectoryPath}/${sanitizedSubject}_worksheet_${sessionId}.pdf`;
    
    await RNFS.writeFile(filePath, base64Data, 'base64');
    return filePath;
  } catch (error) {
    console.error('Failed to export PDF worksheet:', error);
    throw error;
  }
};
