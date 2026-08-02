const PREVIEW_TITLE_FALLBACK = 'Предпросмотр курса — TeamOS';

export function coursePreviewDocumentTitle(courseTitle?: string): string {
  const normalizedTitle = courseTitle?.trim();
  return normalizedTitle ? `${normalizedTitle} — Предпросмотр — TeamOS` : PREVIEW_TITLE_FALLBACK;
}
