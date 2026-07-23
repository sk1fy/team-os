import { ApiError } from '@/api/client';

export type ExternalErrorRecovery =
  | 'none'
  | 'retry'
  | 'retry_later'
  | 'restart_verification'
  | 'edit_identity'
  | 'reload_landing';

export interface ExternalErrorPresentation {
  title: string;
  description: string;
  recovery: ExternalErrorRecovery;
}

const presentations: Record<string, ExternalErrorPresentation> = {
  COURSE_ARCHIVED: {
    title: 'Курс в архиве',
    description: 'Новые активации для этого курса закрыты.',
    recovery: 'none',
  },
  COURSE_DELETED: {
    title: 'Курс недоступен',
    description: 'Курс был удалён. Сохранённые результаты остаются у автора обучения.',
    recovery: 'none',
  },
  COURSE_BLOCKED: {
    title: 'Курс временно недоступен',
    description: 'Доступ ограничен администрацией. Попробуйте позже.',
    recovery: 'retry_later',
  },
  DISTRIBUTION_PAUSED: {
    title: 'Активации приостановлены',
    description: 'Автор временно остановил выдачу новых доступов.',
    recovery: 'retry_later',
  },
  ACCESS_REVOKED: {
    title: 'Доступ отозван',
    description: 'Этот доступ больше нельзя использовать. Обратитесь к автору курса.',
    recovery: 'none',
  },
  ACCESS_EXPIRED: {
    title: 'Срок доступа истёк',
    description: 'Новый контент закрыт. Завершённые результаты остаются сохранены.',
    recovery: 'none',
  },
  EMAIL_MISMATCH: {
    title: 'Email не подходит',
    description: 'Введите адрес, для которого была создана персональная ссылка.',
    recovery: 'edit_identity',
  },
  VERIFICATION_EXPIRED: {
    title: 'Код подтверждения истёк',
    description: 'Запросите новый код и повторите подтверждение.',
    recovery: 'restart_verification',
  },
  VERIFICATION_RATE_LIMITED: {
    title: 'Слишком много попыток',
    description: 'Подождите перед повторной отправкой или проверкой кода.',
    recovery: 'retry_later',
  },
  ENROLLMENT_ALREADY_EXISTS: {
    title: 'Доступ уже активирован',
    description: 'Обновляем приглашение, чтобы открыть существующее прохождение.',
    recovery: 'reload_landing',
  },
};

export function presentExternalError(
  error: unknown,
  fallback: ExternalErrorPresentation,
): ExternalErrorPresentation {
  if (!(error instanceof ApiError) || !error.code) return fallback;
  return presentations[error.code] ?? fallback;
}
