// Owner: S3 | Purpose: Zustand store — persisted user authentication state

import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import RNFS from 'react-native-fs';

interface User {
  name: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  setHasSeenOnboarding: (seen: boolean) => void;
}

// Custom storage provider using react-native-fs to persist auth on-device offline
const fsAuthStorage: StateStorage = {
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
      console.error('Failed to write auth file:', e);
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      hasSeenOnboarding: false,
      user: null,
      login: (user) => set({ isAuthenticated: true, user, hasSeenOnboarding: true }),
      logout: () => set({ isAuthenticated: false, user: null }),
      setHasSeenOnboarding: (seen) => set({ hasSeenOnboarding: seen }),
    }),
    {
      name: 'user-auth',
      storage: createJSONStorage(() => fsAuthStorage),
    }
  )
);
