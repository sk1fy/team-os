import type { AcademyCourseDetail } from '@/types/academy';

type CourseVisibility = AcademyCourseDetail['visibility'];

const visibilityLabels: Record<CourseVisibility, string> = {
  restricted: 'Только по назначению',
  company: 'Вся компания',
  public: 'Публичный',
};

export function getPublishVisibilityDescription(
  currentVisibility: CourseVisibility,
  selectedVisibility: CourseVisibility | null,
): string {
  if (selectedVisibility) {
    return `Выбранная настройка: ${visibilityLabels[selectedVisibility]}. Она будет применена после публикации.`;
  }
  return `Текущая настройка: ${visibilityLabels[currentVisibility]}. Выберите режим доступа для публикации.`;
}

export function getControlledPublishVisibilityValue(
  visibility: CourseVisibility | null,
): CourseVisibility | '' {
  return visibility ?? '';
}
