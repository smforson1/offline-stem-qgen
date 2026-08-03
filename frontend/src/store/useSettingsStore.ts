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
  setApiUrl: (url: string) => void;
  setDefaultSubject: (subject: string) => void;
  setDefaultDifficulty: (difficulty: string) => void;
  setDefaultQuestionType: (type: 'mcq' | 'short_answer') => void;
  setDefaultQuestionCount: (count: number) => void;
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
      apiUrl: 'http://10.25.116.200:5000', // Static IP — set permanently via Windows adapter settings
      defaultSubject: 'Physics',
      defaultDifficulty: 'Medium',
      defaultQuestionType: 'mcq',
      defaultQuestionCount: 5,
      setApiUrl: (url) => set({ apiUrl: url }),
      setDefaultSubject: (subject) => set({ defaultSubject: subject }),
      setDefaultDifficulty: (difficulty) => set({ defaultDifficulty: difficulty }),
      setDefaultQuestionType: (type) => set({ defaultQuestionType: type }),
      setDefaultQuestionCount: (count) => set({ defaultQuestionCount: count }),
    }),
    {
      name: 'user-settings',
      storage: createJSONStorage(() => fsStorage),
    }
  )
);
