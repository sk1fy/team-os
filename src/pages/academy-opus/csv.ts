/**
 * Выгрузка отчёта файлом.
 *
 * Базовая Академия по кнопке «CSV» кладёт данные в буфер обмена — файла
 * не появляется. Здесь честное скачивание, с BOM, чтобы Excel не ломал
 * кириллицу.
 */

function escapeCell(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Array<string | number | undefined>>): string {
  return rows.map((row) => row.map(escapeCell).join(';')).join('\r\n');
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | undefined>>) {
  // BOM обязателен: без него Excel читает UTF-8 как ANSI и портит кириллицу.
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
