import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * UI-состояние приложения: тема, сайдбар, глобальные модалки и фильтры.
 * Серверные данные сюда не кладём — они живут в TanStack Query.
 */

export type Theme = 'light' | 'dark';

interface UiState {
  /** Цветовая тема интерфейса. */
  theme: Theme;
  setTheme: (theme: Theme) => void;

  /**
   * Узкие экраны: открыта ли навигация (рейл и панель раздела выезжают слева).
   * На широких экранах навигация видна всегда.
   */
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;

  /** Глобальный фильтр по отделу (используется списками сотрудников/задач). */
  globalDepartmentId: string | null;
  setGlobalDepartmentId: (id: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),

      navOpen: false,
      setNavOpen: (open) => set({ navOpen: open }),

      globalDepartmentId: null,
      setGlobalDepartmentId: (id) => set({ globalDepartmentId: id }),
    }),
    {
      name: 'teamos-ui',
      // Эфемерное состояние (открытая навигация) не персистим.
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
