/**
 * Страницы-заглушки модулей. Каждая заменяется реальной реализацией
 * в своём этапе плана (2 — БЗ, 3 — задачи, 4 — академия).
 */

import { GraduationCap, KanbanSquare, Library, Settings } from 'lucide-react';
import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder';

export function KnowledgePage() {
  return (
    <ModulePlaceholder
      title="База знаний"
      description="Регламенты, инструкции и статьи компании."
      icon={Library}
      stage={2}
    />
  );
}

export function TasksPage() {
  return (
    <ModulePlaceholder
      title="Задачи"
      description="Kanban-доски, списки и календарь задач."
      icon={KanbanSquare}
      stage={3}
    />
  );
}

export function AcademyPage() {
  return (
    <ModulePlaceholder
      title="Академия"
      description="Курсы, тесты и обучение сотрудников и партнёров."
      icon={GraduationCap}
      stage={4}
    />
  );
}

export function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Настройки"
      description="Профиль компании, роли и интеграции."
      icon={Settings}
      stage={5}
    />
  );
}
