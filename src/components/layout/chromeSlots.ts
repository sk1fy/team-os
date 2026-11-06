import { createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { readTabKey } from './navigation';

/**
 * Слоты каркаса: страница рендерит свой заголовок, действия и контекст
 * раздела, а каркас показывает их в шапке и в панели раздела слева.
 * Вне каркаса (полноэкранные страницы) всё рендерится на месте.
 */
export interface ChromeSlots {
  /** Заголовок и описание страницы в шапке. */
  header: HTMLElement | null;
  /** Главные действия страницы справа в шапке. */
  actions: HTMLElement | null;
  /** Контекст раздела (фильтры, разделы) в панели слева под вкладками. */
  sectionContext: HTMLElement | null;
}

export const ChromeSlotsContext = createContext<ChromeSlots | null>(null);

export function useChromeSlots() {
  return useContext(ChromeSlotsContext);
}

/**
 * Ключ вкладки страницы из `?tab=`. Вкладки показывает каркас в панели раздела
 * (см. `navigation.ts`), страница только читает выбранную.
 */
export function useSectionTab<K extends string>(keys: readonly K[], fallback: K): K {
  const { search } = useLocation();
  return readTabKey(search, keys, fallback);
}

/** Классы пункта панели раздела — вкладки, фильтра или виджета группы. */
export function sectionItemClass(active: boolean, disabled = false) {
  return [
    'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm transition-colors',
    disabled
      ? 'cursor-not-allowed text-slate-400'
      : active
        ? 'bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--color-slate-200),0_1px_2px_rgb(0_0_0/0.05)] dark:shadow-[0_0_0_1px_#334155]'
        : 'cursor-pointer font-medium text-slate-600 hover:bg-slate-100 hover:text-ink',
  ].join(' ');
}
