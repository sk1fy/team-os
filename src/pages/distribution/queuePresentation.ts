const finishedStates = new Set([
  'confirmed',
  'succeeded',
  'completed',
  'kept',
  'cancelled',
  'failed',
  'error',
]);
export const isQueueFinished = (state: string) => finishedStates.has(state);
export const isQueueConfirmed = (state: string) =>
  ['confirmed', 'succeeded', 'completed', 'kept'].includes(state);
export function queueDuration(createdAt: string, end: string | number): string {
  const minutes = Math.max(
    0,
    Math.floor(((typeof end === 'number' ? end : Date.parse(end)) - Date.parse(createdAt)) / 60000),
  );
  if (!Number.isFinite(minutes)) return 'Время неизвестно';
  if (minutes < 60) return `${minutes} мин.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. ${minutes % 60} мин.`;
  return `${Math.floor(hours / 24)} д. ${hours % 24} ч.`;
}
// datetime-local has no zone. Interpret filters in the account's zone, never in
// the browser's zone. Reject gaps (DST) instead of silently shifting the filter.
export function accountDateTime(value: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Укажите дату и время фильтра.');
  const [, y, m, d, h, min] = match.map(Number);
  const target = Date.UTC(y, m - 1, d, h, min);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const localTimestamp = (timestamp: number) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(timestamp).map((part) => [part.type, part.value]),
    );
    return Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
  };
  let utc = target;
  for (let attempt = 0; attempt < 4; attempt++) utc += target - localTimestamp(utc);
  if (localTimestamp(utc) !== target)
    throw new Error('Это время отсутствует в часовом поясе аккаунта. Выберите другое время.');
  return new Date(utc).toISOString();
}
