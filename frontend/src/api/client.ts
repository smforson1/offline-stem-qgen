// Owner: S3 | Purpose: Axios instance configured for local Flask API base URL

import axios from 'axios';
import { useSettingsStore } from '../store/useSettingsStore';

const apiClient = axios.create({
  timeout: 90000, // 90 seconds timeout to accommodate slow CPU OCR/LLM generation on the Pi
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject the dynamic apiUrl configured by the user in Settings
apiClient.interceptors.request.use(
  (config) => {
    const { apiUrl } = useSettingsStore.getState();
    // Trim trailing slash if present
    config.baseURL = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
