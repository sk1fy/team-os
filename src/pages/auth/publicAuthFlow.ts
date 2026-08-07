import { ApiError } from '@/api/client';
import type { BootstrapActivationState, CompanyStatus } from '@/types';

export type PublicAuthErrorAction = 'none' | 'login' | 'retry';

export interface PublicAuthErrorView {
  title: string;
  description: string;
  action: PublicAuthErrorAction;
}

const invalidLink: PublicAuthErrorView = {
  title: 'Ссылка недействительна',
  description: 'Откройте TeamOS заново из amoCRM или попросите отправить новую ссылку.',
  action: 'none',
};

export function publicAuthErrorView(error: unknown): PublicAuthErrorView {
  const code = error instanceof ApiError ? error.code : undefined;

  if (code === 'BOOTSTRAP_EXPIRED' || code === 'SSO_EXPIRED') {
    return {
      title: 'Срок действия ссылки истёк',
      description: 'Запросите новую ссылку и повторите попытку.',
      action: 'none',
    };
  }
  if (code === 'BOOTSTRAP_CONSUMED' || code === 'SSO_CONSUMED') {
    return {
      title: 'Ссылка уже использована',
      description: 'Войдите по email или откройте TeamOS заново из amoCRM.',
      action: 'login',
    };
  }
  if (code === 'EXTERNAL_USER_DEACTIVATED') {
    return {
      title: 'Нет доступа к TeamOS',
      description: 'Ваша учётная запись отключена. Обратитесь к администратору компании.',
      action: 'none',
    };
  }
  if (code === 'INTEGRATION_FROZEN' || code === 'COMPANY_FROZEN') {
    return {
      title: 'TeamOS временно недоступен',
      description: 'Компания или интеграция заморожена. Обратитесь к администратору.',
      action: 'none',
    };
  }
  if (code === 'COMPANY_SUSPENDED') {
    return {
      title: 'Доступ приостановлен',
      description: 'Работа компании в TeamOS приостановлена. Обратитесь к администратору.',
      action: 'none',
    };
  }
  if (code === 'BOOTSTRAP_INVALID' || code === 'SSO_INVALID') return invalidLink;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return invalidLink;
  }
  return {
    title: 'Не удалось связаться с TeamOS',
    description: 'Проверьте подключение к интернету и повторите попытку.',
    action: 'retry',
  };
}

export function activationStateError(state: BootstrapActivationState): ApiError | undefined {
  if (state === 'pending') return undefined;
  const code =
    state === 'expired'
      ? 'BOOTSTRAP_EXPIRED'
      : state === 'consumed' || state === 'completed'
        ? 'BOOTSTRAP_CONSUMED'
        : 'BOOTSTRAP_INVALID';
  return new ApiError('Ссылка активации недоступна', 409, { code });
}

export function companyStatusError(status: CompanyStatus): ApiError | undefined {
  if (status === 'frozen') {
    return new ApiError('Компания заморожена', 403, { code: 'COMPANY_FROZEN' });
  }
  if (status === 'suspended') {
    return new ApiError('Доступ компании приостановлен', 403, { code: 'COMPANY_SUSPENDED' });
  }
  return undefined;
}

export function validateActivationPasswords(password: string, confirmation: string) {
  if (password.length < 8) return 'Пароль должен содержать не менее 8 символов';
  if (password !== confirmation) return 'Пароли не совпадают';
  return undefined;
}
