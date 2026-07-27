import { AlertTriangle, CircleAlert } from 'lucide-react';
import { Button, Modal, Select } from '@/components/ui';
import type { AcademyCourseDetail } from '@/types/academy';

type CourseVisibility = AcademyCourseDetail['visibility'];

const visibilityLabels: Record<CourseVisibility, string> = {
  restricted: 'Только по назначению',
  company: 'Вся компания',
  public: 'Публичный',
};

export interface PublishValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  sectionId?: string;
  sectionTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
}

export function PublishDialog({
  open,
  onClose,
  onConfirm,
  loading,
  lessonCount,
  sectionCount,
  issues,
  currentVisibility,
  visibility,
  onVisibilityChange,
  onNavigateToIssue,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  lessonCount: number;
  sectionCount: number;
  issues: PublishValidationIssue[];
  currentVisibility: CourseVisibility;
  visibility: CourseVisibility | null;
  onVisibilityChange: (visibility: CourseVisibility) => void;
  onNavigateToIssue?: (issue: PublishValidationIssue) => void;
}) {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const canPublish = errors.length === 0 && visibility !== null;

  const issueLabel = (issue: PublishValidationIssue) =>
    [issue.sectionTitle, issue.lessonTitle].filter(Boolean).join(' → ');

  const renderIssues = (
    title: string,
    groupedIssues: PublishValidationIssue[],
    severity: PublishValidationIssue['severity'],
  ) => {
    if (groupedIssues.length === 0) return null;
    const isError = severity === 'error';
    return (
      <section
        className={
          isError
            ? 'rounded-lg border border-danger-100 bg-danger-50 p-3 text-danger-700'
            : 'rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900'
        }
      >
        <h3 className="flex items-center gap-2 font-semibold">
          {isError ? <CircleAlert className="size-4" /> : <AlertTriangle className="size-4" />}
          {title} — {groupedIssues.length}
        </h3>
        <ul className="mt-2 space-y-2">
          {groupedIssues.map((issue, index) => {
            const location = issueLabel(issue);
            const content = (
              <>
                {location ? <span className="font-medium">{location}: </span> : null}
                {issue.message}
              </>
            );
            return (
              <li key={`${severity}-${issue.lessonId ?? issue.sectionId ?? index}-${issue.message}`}>
                {(issue.lessonId || issue.sectionId) && onNavigateToIssue ? (
                  <button
                    type="button"
                    className="text-left underline decoration-current/40 underline-offset-2 hover:decoration-current"
                    onClick={() => onNavigateToIssue(issue)}
                  >
                    {content}
                  </button>
                ) : (
                  <span>{content}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Опубликовать версию?"
      description="Текущий черновик станет неизменяемой опубликованной версией. Начатые прохождения останутся на своей версии."
    >
      <div className="space-y-4 text-sm text-slate-600">
        <ul className="list-inside list-disc space-y-1">
          <li>
            Разделов: {sectionCount}
          </li>
          <li>Уроков: {lessonCount}</li>
          <li>Для следующих правок потребуется создать новый черновик</li>
          <li>Начатые прохождения не переключатся автоматически</li>
        </ul>
        <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Select
            label="Кому будет доступен курс после публикации"
            value={visibility ?? undefined}
            disabled={loading}
            placeholder="Выберите режим доступа"
            onValueChange={(value) => onVisibilityChange(value as CourseVisibility)}
            options={[
              {
                value: 'restricted',
                label: 'Только по назначению — без размещения в каталоге',
              },
              {
                value: 'company',
                label: 'Вся компания — с размещением в каталоге',
              },
              {
                value: 'public',
                label: 'Публичный',
              },
            ]}
          />
          <p className="text-xs text-slate-500">
            Текущая настройка: {visibilityLabels[currentVisibility]}. Выбор обязателен, чтобы курс
            не остался скрытым или публичным случайно.
          </p>
        </section>
        {renderIssues('Ошибки, блокирующие публикацию', errors, 'error')}
        {renderIssues('Предупреждения', warnings, 'warning')}
        {issues.length === 0 && visibility ? (
          <p className="rounded-lg border border-success-100 bg-success-50 px-3 py-2 text-success-700">
            Проверка пройдена — версия готова к публикации.
          </p>
        ) : issues.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
            Содержание проверено. Выберите режим доступа для публикации.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={loading} disabled={!canPublish} onClick={onConfirm}>
            Опубликовать
          </Button>
        </div>
      </div>
    </Modal>
  );
}
