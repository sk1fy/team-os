export type CoursePreviewPresentation = {
  headerLabel: string;
  accessibleHeaderLabel: string;
  statusText: string;
};

export function coursePreviewPresentation(isDraft: boolean): CoursePreviewPresentation {
  const subject = isDraft ? 'Черновик' : 'Версия';
  return {
    headerLabel: `${subject} · предпросмотр`,
    accessibleHeaderLabel: `${subject}. Режим предпросмотра без сохранения прогресса.`,
    statusText: 'Предпросмотр: уроки, тесты и прогресс не сохраняются',
  };
}
