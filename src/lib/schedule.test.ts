import { describe, expect, it } from 'vitest';
import {
  baseState,
  dayState,
  daysInMonth,
  formatHours,
  formatShiftRange,
  isWeekend,
  shiftHours,
  weekdayIndex,
} from './schedule';
import type { CycleTemplate, ShiftException, WeekTemplate } from '@/types';

const week: WeekTemplate = { type: 'week', days: [0, 1, 2, 3, 4], start: '09:00', end: '18:00' };
// Цикл 2/2 со стартом 1 июля 2026 (среда).
const cycle: CycleTemplate = {
  type: 'cycle',
  on: 2,
  off: 2,
  start: '09:00',
  end: '21:00',
  cycleStart: '2026-07-01',
};

describe('календарь', () => {
  it('weekdayIndex: 1 июля 2026 — среда (индекс 2)', () => {
    expect(weekdayIndex(2026, 7, 1)).toBe(2);
  });

  it('isWeekend: 4–5 июля 2026 — суббота и воскресенье', () => {
    expect(isWeekend(2026, 7, 4)).toBe(true);
    expect(isWeekend(2026, 7, 5)).toBe(true);
    expect(isWeekend(2026, 7, 6)).toBe(false);
  });

  it('daysInMonth учитывает длину месяца и високосность', () => {
    expect(daysInMonth(2026, 7)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});

describe('baseState', () => {
  it('пятидневка: будни рабочие, выходные — нет', () => {
    expect(baseState(week, 2026, 7, 6).type).toBe('work'); // понедельник
    expect(baseState(week, 2026, 7, 4).type).toBe('off'); // суббота
  });

  it('цикл 2/2: работа 1–2, отдых 3–4, снова работа 5–6', () => {
    expect(baseState(cycle, 2026, 7, 1).type).toBe('work');
    expect(baseState(cycle, 2026, 7, 2).type).toBe('work');
    expect(baseState(cycle, 2026, 7, 3).type).toBe('off');
    expect(baseState(cycle, 2026, 7, 4).type).toBe('off');
    expect(baseState(cycle, 2026, 7, 5).type).toBe('work');
  });

  it('цикл корректен для дат раньше старта цикла', () => {
    // 30 июня — за день до старта: индекс -1 → последний день цикла (выходной)
    expect(baseState(cycle, 2026, 6, 30).type).toBe('off');
    expect(baseState(cycle, 2026, 6, 29).type).toBe('off');
    expect(baseState(cycle, 2026, 6, 28).type).toBe('work');
  });
});

describe('dayState', () => {
  it('правка перекрывает шаблон', () => {
    const exception: ShiftException = {
      id: 'x1',
      userId: 'user-1',
      date: '2026-07-06',
      type: 'sick',
    };
    expect(dayState(week, exception, 2026, 7, 6).type).toBe('sick');
    expect(dayState(week, undefined, 2026, 7, 6).type).toBe('work');
  });
});

describe('часы и форматирование', () => {
  it('shiftHours: обычная и ночная смена', () => {
    expect(shiftHours('09:00', '18:00')).toBe(9);
    expect(shiftHours('09:30', '18:00')).toBe(8.5);
    expect(shiftHours('21:00', '09:00')).toBe(12); // через полночь
  });

  it('formatShiftRange сжимает круглое время', () => {
    expect(formatShiftRange('09:00', '18:00')).toBe('9–18');
    expect(formatShiftRange('09:30', '18:00')).toBe('9:30–18');
  });

  it('formatHours: русская десятичная запись', () => {
    expect(formatHours(8.5)).toBe('8,5');
    expect(formatHours(9)).toBe('9');
  });
});
