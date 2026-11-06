import { useEffect } from 'react';
import { create } from 'zustand';

type TabCounts = Partial<Record<string, number>>;

const useTabCountsStore = create<{ counts: TabCounts }>(() => ({ counts: {} }));

function setCount(key: string, count: number | undefined) {
  useTabCountsStore.setState(({ counts }) => {
    const next = { ...counts };
    if (count === undefined) delete next[key];
    else next[key] = count;
    return { counts: next };
  });
}

/** Числа на вкладках панели раздела, по ключу вкладки. */
export function useTabCounts(): TabCounts {
  return useTabCountsStore((state) => state.counts);
}

/**
 * Показать число на вкладке панели раздела («Правила 5»). Пока данных нет —
 * передайте `undefined`; при уходе со страницы число убирается.
 */
export function useSectionTabCount(key: string, count: number | undefined) {
  useEffect(() => {
    setCount(key, count);
  }, [key, count]);
  useEffect(() => () => setCount(key, undefined), [key]);
}
