/**
 * Чистая логика графика работы: разворачивание шаблонов в состояния дней,
 * подсчёт часов и форматирование. Не зависит от React и API.
 */

import type { ScheduleTemplate, ShiftException, ShiftType } from '@/types';

/** Состояние конкретного дня сотрудника после применения шаблона и правок. */
export interface DayState {
  type: ShiftType;
  start?: string;
  end?: string;
  note?: string;
}

export const WEEKDAY_SHORT = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

export const MONTH_LABELS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

/** Родительный падеж — для дат вида «8 июля 2026». */
export const MONTH_LABELS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD для дня месяца (month: 1–12). */
export function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Ключ месяца YYYY-MM (month: 1–12). */
export function monthKey(year: number, month: number) {
  return `${year}-${pad(month)}`;
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

/** День недели: 0 = Пн … 6 = Вс. */
export function weekdayIndex(year: number, month: number, day: number) {
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

export function isWeekend(year: number, month: number, day: number) {
  return weekdayIndex(year, month, day) >= 5;
}

function parseIso(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Плановое состояние дня по шаблону сотрудника (без учёта правок). */
export function baseState(template: ScheduleTemplate, year: number, month: number, day: number): DayState {
  if (template.type === 'week') {
    return template.days.includes(weekdayIndex(year, month, day))
      ? { type: 'work', start: template.start, end: template.end }
      : { type: 'off' };
  }
  const cycle = template.on + template.off || 1;
  const diffDays = Math.round(
    (new Date(year, month - 1, day).getTime() - parseIso(template.cycleStart).getTime()) / 86_400_000,
  );
  let index = diffDays % cycle;
  if (index < 0) index += cycle;
  return index < template.on
    ? { type: 'work', start: template.start, end: template.end }
    : { type: 'off' };
}

/** Итоговое состояние дня: правка важнее шаблона. */
export function dayState(
  template: ScheduleTemplate,
  exception: ShiftException | undefined,
  year: number,
  month: number,
  day: number,
): DayState {
  if (exception) {
    return {
      type: exception.type,
      start: exception.start,
      end: exception.end,
      note: exception.note,
    };
  }
  return baseState(template, year, month, day);
}

/** Длительность смены в часах; ночные смены (через полночь) поддерживаются. */
export function shiftHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = eh! * 60 + em! - (sh! * 60 + sm!);
  if (minutes < 0) minutes += 1440;
  return minutes / 60;
}

/** «9», «18:30» — компактное время для узкой ячейки. */
export function formatShiftTime(time: string) {
  const [h, m] = time.split(':');
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
}

/** «9–18» — компактный диапазон смены. */
export function formatShiftRange(start: string, end: string) {
  return `${formatShiftTime(start)}–${formatShiftTime(end)}`;
}

/** Часы с одним знаком после запятой в русской записи: 7.5 → «7,5». */
export function formatHours(hours: number) {
  return String(Math.round(hours * 10) / 10).replace('.', ',');
}
