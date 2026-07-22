import type {
  CourseDistributionStatus,
  CourseLifecycleStatus,
  EnrollmentAccessStatus,
  EnrollmentProgressStatus,
  InternalReportRowStatus,
} from '@/types/academy';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
}

export function lifecycleStatusLabel(status: CourseLifecycleStatus): StatusPresentation {
  switch (status) {
    case 'active':
      return { label: 'Активен', tone: 'success' };
    case 'archived':
      return { label: 'В архиве', tone: 'neutral' };
    case 'deleted':
      return { label: 'Удалён', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function distributionStatusLabel(status: CourseDistributionStatus): StatusPresentation {
  switch (status) {
    case 'active':
      return { label: 'Распространяется', tone: 'success' };
    case 'paused':
      return { label: 'Распространение приостановлено', tone: 'warning' };
    case 'blocked':
      return { label: 'Заблокирован', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function enrollmentProgressLabel(status: EnrollmentProgressStatus): StatusPresentation {
  switch (status) {
    case 'not_started':
      return { label: 'Не начат', tone: 'neutral' };
    case 'in_progress':
      return { label: 'В процессе', tone: 'info' };
    case 'completed':
      return { label: 'Завершён', tone: 'success' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function enrollmentAccessLabel(status: EnrollmentAccessStatus): StatusPresentation {
  switch (status) {
    case 'invited':
      return { label: 'Приглашён', tone: 'neutral' };
    case 'ready':
      return { label: 'Готов к старту', tone: 'info' };
    case 'active':
      return { label: 'Активен', tone: 'success' };
    case 'expired':
      return { label: 'Срок истёк', tone: 'warning' };
    case 'frozen':
      return { label: 'Заморожен', tone: 'neutral' };
    case 'suspended':
      return { label: 'Приостановлен', tone: 'warning' };
    case 'revoked':
      return { label: 'Отозван', tone: 'danger' };
    case 'closed':
      return { label: 'Закрыт', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function reportRowStatusLabel(status: InternalReportRowStatus): StatusPresentation {
  switch (status) {
    case 'not_started':
      return { label: 'Не начат', tone: 'neutral' };
    case 'in_progress':
      return { label: 'В процессе', tone: 'info' };
    case 'completed':
      return { label: 'Завершён', tone: 'success' };
    case 'overdue':
      return { label: 'Просрочен', tone: 'danger' };
    case 'frozen':
      return { label: 'Заморожен', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function statusToneClasses(tone: StatusTone): string {
  switch (tone) {
    case 'success':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
    case 'warning':
      return 'bg-amber-50 text-amber-800 ring-amber-600/20';
    case 'danger':
      return 'bg-red-50 text-red-700 ring-red-600/20';
    case 'info':
      return 'bg-sky-50 text-sky-700 ring-sky-600/20';
    case 'neutral':
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-500/10';
  }
}
