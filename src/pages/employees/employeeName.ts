export function splitEmployeeName(
  value: string,
  fallback: { firstName: string; lastName: string },
) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;

  return {
    firstName: parts[0],
    // В карточке имя и фамилия находятся в одном поле. При вводе только имени
    // сохраняем существующую фамилию: API не принимает пустую фамилию.
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : fallback.lastName,
  };
}
