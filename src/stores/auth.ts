import { create } from 'zustand';

interface AuthState {
  /** JWT намеренно хранится только в памяти и исчезает при перезагрузке страницы. */
  accessToken: string | null;
  initialized: boolean;
  setAccessToken: (accessToken: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  initialized: false,
  setAccessToken: (accessToken) => set({ accessToken }),
  setInitialized: (initialized) => set({ initialized }),
  clear: () => set({ accessToken: null, initialized: true }),
}));
