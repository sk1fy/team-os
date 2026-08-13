export function normalizeNewLessonTitle(value: string): string | null {
  const title = value.trim().replace(/\s+/g, ' ');
  return title || null;
}
