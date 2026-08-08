// Owner: S3 | Purpose: Zustand store — persisted user preferences

import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import RNFS from 'react-native-fs';

interface SettingsState {
  apiUrl: string;
  defaultSubject: string;
  defaultDifficulty: string;
  defaultQuestionType: 'mcq' | 'short_answer';
  defaultQuestionCount: number;
  geminiApiKey: string;
  setApiUrl: (url: string) => void;
  setDefaultSubject: (subject: string) => void;
  setDefaultDifficulty: (difficulty: string) => void;
  setDefaultQuestionType: (type: 'mcq' | 'short_answer') => void;
  setDefaultQuestionCount: (count: number) => void;
  setGeminiApiKey: (key: string) => void;
}

// Custom storage provider using react-native-fs to persist settings on-device offline
const fsStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const path = `${RNFS.DocumentDirectoryPath}/${name}.json`;
    try {
      const exists = await RNFS.exists(path);
      if (!exists) return null;
      return await RNFS.readFile(path, 'utf8');
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const path = `${RNFS.DocumentDirectoryPath}/${name}.json`;
    try {
      await RNFS.writeFile(path, value, 'utf8');
    } catch (e) {
      console.error('Failed to write settings file:', e);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    const path = `${RNFS.DocumentDirectoryPath}/${name}.json`;
    try {
      if (await RNFS.exists(path)) {
        await RNFS.unlink(path);
      }
    } catch {}
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiUrl: 'http://10.0.2.2:5000',
      defaultSubject: 'Physics',
      defaultDifficulty: 'Medium',
      defaultQuestionType: 'mcq',
      defaultQuestionCount: 5,
      geminiApiKey: '',
      setApiUrl: (url) => set({ apiUrl: url }),
      setDefaultSubject: (subject) => set({ defaultSubject: subject }),
      setDefaultDifficulty: (difficulty) => set({ defaultDifficulty: difficulty }),
      setDefaultQuestionType: (type) => set({ defaultQuestionType: type }),
      setDefaultQuestionCount: (count) => set({ defaultQuestionCount: count }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
    }),
    {
      name: 'user-settings',
      storage: createJSONStorage(() => fsStorage),
    }
  )
);

/**
 * Tries a list of candidate backend URLs and updates the store with the first
 * one that responds to /health. Call this once on app startup.
 *
 * Priority order:
 *  1. Android emulator alias (10.0.2.2) — works when running on emulator
 *  2. mDNS hostname — works when on same LAN as the laptop
 *  3. Current stored URL — user's manual setting, used as final fallback
 */
export const autoDiscoverBackend = async (): Promise<void> => {
  const { apiUrl, setApiUrl } = useSettingsStore.getState();

  const candidates = [
    'http://10.0.2.2:5000',               // Android emulator
    'http://LAPTOP-S1B9T1CV.local:5000',   // mDNS — physical device on same LAN
    apiUrl,                                // user's current saved URL
  ];

  // Deduplicate
  const seen = new Set<string>();
  const unique = candidates.filter((u) => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  for (const url of unique) {
    try {
      const base = url.endsWith('/') ? url.slice(0, -1) : url;
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        if (url !== apiUrl) {
          setApiUrl(url);
          console.log(`[autoDiscoverBackend] Connected via ${url}`);
        }
        return;
      }
    } catch {
      // try next
    }
  }
  console.log('[autoDiscoverBackend] No backend found — user must set URL manually');
};
