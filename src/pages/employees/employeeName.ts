export function splitEmployeeName(
  value: string,
  fallback: { firstName: string; lastName: string },
) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;

  return {
    firstName: parts[0],
    // Общее поле имени считаем полным источником: удаление фамилии тоже должно сохраниться.
    lastName: parts.slice(1).join(' '),
  };
}
