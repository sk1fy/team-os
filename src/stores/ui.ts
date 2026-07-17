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

  /** Десктоп: свёрнут ли сайдбар до иконок. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  /** Мобильный: открыт ли сайдбар-оверлей. */
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  /** Глобальный фильтр по отделу (используется списками сотрудников/задач). */
  globalDepartmentId: string | null;
  setGlobalDepartmentId: (id: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      mobileSidebarOpen: false,
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

      globalDepartmentId: null,
      setGlobalDepartmentId: (id) => set({ globalDepartmentId: id }),
    }),
    {
      name: 'teamos-ui',
      // Эфемерное состояние (мобильный сайдбар) не персистим.
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
