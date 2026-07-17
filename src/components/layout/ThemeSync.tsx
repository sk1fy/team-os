import { useLayoutEffect } from 'react';
import { useUiStore } from '@/stores/ui';

export function ThemeSync() {
  const theme = useUiStore((state) => state.theme);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return null;
}
