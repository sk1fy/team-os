const DEFAULT_SNIPPET_LENGTH = 180;

export type HighlightedTextPart = {
  text: string;
  highlighted: boolean;
};

function normalizeSearchText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function trimAtWordBoundary(value: string, fromStart: boolean): string {
  const boundary = fromStart ? value.indexOf(' ') : value.lastIndexOf(' ');
  if (boundary <= 0) return value;
  return fromStart ? value.slice(boundary + 1) : value.slice(0, boundary);
}

/**
 * Returns a compact excerpt around the first match. The result is plain text:
 * React remains responsible for escaping it when rendered.
 */
export function createKnowledgeSearchSnippet(
  value: string,
  query: string,
  maxLength = DEFAULT_SNIPPET_LENGTH,
): string {
  const text = normalizeSearchText(value);
  if (!text || maxLength <= 0) return '';
  if (text.length <= maxLength) return text;

  const normalizedQuery = normalizeSearchText(query).toLocaleLowerCase('ru');
  const matchIndex = normalizedQuery ? text.toLocaleLowerCase('ru').indexOf(normalizedQuery) : -1;
  const desiredStart =
    matchIndex >= 0 ? matchIndex - Math.floor((maxLength - normalizedQuery.length) / 2) : 0;
  const start = Math.max(0, Math.min(desiredStart, text.length - maxLength));
  const end = Math.min(text.length, start + maxLength);
  let excerpt = text.slice(start, end);

  if (start > 0) excerpt = trimAtWordBoundary(excerpt, true);
  if (end < text.length) excerpt = trimAtWordBoundary(excerpt, false);

  return `${start > 0 ? '…' : ''}${excerpt}${end < text.length ? '…' : ''}`;
}

/** Splits plain text into safe React-ready parts without using innerHTML. */
export function splitKnowledgeSearchHighlight(value: string, query: string): HighlightedTextPart[] {
  const normalizedQuery = normalizeSearchText(query).toLocaleLowerCase('ru');
  if (!normalizedQuery) return [{ text: value, highlighted: false }];

  const parts: HighlightedTextPart[] = [];
  const lowerValue = value.toLocaleLowerCase('ru');
  let cursor = 0;
  let matchIndex = lowerValue.indexOf(normalizedQuery, cursor);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push({ text: value.slice(cursor, matchIndex), highlighted: false });
    }
    const matchEnd = matchIndex + normalizedQuery.length;
    parts.push({ text: value.slice(matchIndex, matchEnd), highlighted: true });
    cursor = matchEnd;
    matchIndex = lowerValue.indexOf(normalizedQuery, cursor);
  }

  if (cursor < value.length) parts.push({ text: value.slice(cursor), highlighted: false });
  return parts.length > 0 ? parts : [{ text: value, highlighted: false }];
}
