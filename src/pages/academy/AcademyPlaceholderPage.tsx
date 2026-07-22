import { useTitle } from '@reactuses/core';
import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';

/** Temporary shell for routes scaffolded in Phase 1, filled in later phases. */
export function AcademyPlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  useTitle(`${title} — Академия — TeamOS`);
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Construction}
        title="Раздел в разработке"
        description="Маршрут и foundation готовы. Контент подключится в следующих фазах Academy V2."
      />
    </div>
  );
}

export function AcademyPartnerCoursesPage() {
  return (
    <AcademyPlaceholderPage
      title="Курсы партнёров"
      description="Группировка партнёрских курсов, read-only просмотр, копирование и ограничения."
    />
  );
}

export function AcademyPartnerPage() {
  return (
    <AcademyPlaceholderPage
      title="Партнёр"
      description="Курсы и сводка конкретного партнёра."
    />
  );
}

export function AcademyTemplatesPage() {
  return (
    <AcademyPlaceholderPage
      title="Шаблоны"
      description="Системные и корпоративные шаблоны курсов."
    />
  );
}

export function AcademyTemplatePage() {
  return (
    <AcademyPlaceholderPage
      title="Шаблон"
      description="Карточка шаблона и создание курса на его основе."
    />
  );
}

export function AcademyReportsPage() {
  return (
    <AcademyPlaceholderPage
      title="Отчёты"
      description="Ролевой центр внутренней и внешней отчётности."
    />
  );
}

export function AcademyLearnersPage() {
  return (
    <AcademyPlaceholderPage
      title="Внешние ученики"
      description="Реестр внешних людей компании и timeline прохождений."
    />
  );
}

export function AcademyLearnerPage() {
  return (
    <AcademyPlaceholderPage
      title="Карточка внешнего ученика"
      description="Единая история внешних прохождений."
    />
  );
}

export function AcademyCampaignPage() {
  return (
    <AcademyPlaceholderPage
      title="Кампания"
      description="Funnel и участники промо- или candidate-кампании."
    />
  );
}

export function AcademyEnrollmentReportPage() {
  return (
    <AcademyPlaceholderPage
      title="Индивидуальный отчёт"
      description="Детальный отчёт по enrollment."
    />
  );
}
