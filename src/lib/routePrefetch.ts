/**
 * Префетч чанков ленивых роутов (см. React.lazy в App.tsx) при наведении
 * на пункт меню: к моменту клика чанк раздела уже загружен.
 * Vite переиспользует те же чанки, что и lazy-импорты в App.tsx.
 */
import { isAcademyV2Enabled } from '@/lib/academy';

const loaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/DashboardPage'),
  '/employees': () => import('@/pages/employees/EmployeesPage'),
  '/schedule': () => import('@/pages/schedule/SchedulePage'),
  '/tasks': () => import('@/pages/tasks/TasksPage'),
  '/distribution': () => import('@/pages/distribution/DistributionPage'),
  '/knowledge': () => import('@/pages/knowledge/KnowledgePage'),
  '/academy': () =>
    isAcademyV2Enabled()
      ? import('@/pages/academy/AcademyHomePage')
      : import('@/pages/academy/AcademyPage'),
  '/academy/catalog': () => import('@/pages/academy/AcademyCatalogPage'),
  '/academy/courses': () => import('@/pages/academy/AcademyCoursesPage'),
  '/academy-opus': () => import('@/pages/academy-opus/AcademyOpusPage'),
  '/academy-grok': () => import('@/pages/academy-grok/AcademyGrokHomePage'),
  '/settings': () => import('@/pages/SettingsPage'),
  '/activity-control': () => import('@/pages/activity-control/ActivityControlPage'),
  '/duplicate-search': () => import('@/pages/duplicate-search/DuplicateSearchPage'),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string): void {
  if (prefetched.has(path) || !loaders[path]) return;
  prefetched.add(path);
  // При сбое сети разрешаем повторную попытку на следующем наведении.
  void loaders[path]().catch(() => prefetched.delete(path));
}
