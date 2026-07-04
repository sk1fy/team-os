const relativeFormatter = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
const dateFormatter = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' });
const fullDateFormatter = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** «Сегодня», «вчера», «5 дней назад» или дата для более старых. */
export function formatRelativeDate(iso: string): string {
  const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (Math.abs(diffDays) <= 7) return relativeFormatter.format(diffDays, 'day');
  return dateFormatter.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return fullDateFormatter.format(new Date(iso));
}

/** Русская плюрализация: plural(3, ['отдел', 'отдела', 'отделов']) → 'отдела'. */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
