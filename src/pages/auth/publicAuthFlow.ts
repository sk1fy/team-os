import { ApiError } from '@/api/client';
import type {
  BootstrapActivationState,
  CompanyRegistrationTokenState,
  CompanyStatus,
} from '@/types';

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

  if (code === 'BOOTSTRAP_EXPIRED') {
    return {
      title: 'Срок действия ссылки истёк',
      description: 'Запросите новую ссылку и повторите попытку.',
      action: 'none',
    };
  }
  if (code === 'BOOTSTRAP_CONSUMED') {
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
  if (code === 'BOOTSTRAP_INVALID') return invalidLink;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return invalidLink;
  }
  return {
    title: 'Не удалось связаться с TeamOS',
    description: 'Проверьте подключение к интернету и повторите попытку.',
    action: 'retry',
  };
}

const registrationTokenErrors: Record<
  Exclude<CompanyRegistrationTokenState, 'valid'>,
  PublicAuthErrorView
> = {
  invalid: {
    title: 'Ссылка недействительна',
    description: 'Проверьте ссылку или запросите новый токен регистрации.',
    action: 'none',
  },
  expired: {
    title: 'Срок действия ссылки истёк',
    description: 'Запросите новую ссылку регистрации и повторите попытку.',
    action: 'none',
  },
  consumed: {
    title: 'Ссылка уже использована',
    description: 'Эта компания уже могла быть зарегистрирована. Попробуйте войти по email.',
    action: 'login',
  },
  revoked: {
    title: 'Ссылка отозвана',
    description: 'Запросите новую ссылку регистрации и повторите попытку.',
    action: 'none',
  },
};

export function registrationTokenErrorView(
  error: unknown,
  state?: CompanyRegistrationTokenState,
): PublicAuthErrorView {
  if (state && state !== 'valid') return registrationTokenErrors[state];

  const code = error instanceof ApiError ? error.code : undefined;
  if (code === 'REGISTRATION_TOKEN_INVALID') return registrationTokenErrors.invalid;
  if (code === 'REGISTRATION_TOKEN_EXPIRED') return registrationTokenErrors.expired;
  if (code === 'REGISTRATION_TOKEN_CONSUMED') return registrationTokenErrors.consumed;
  if (code === 'REGISTRATION_TOKEN_REVOKED') return registrationTokenErrors.revoked;
  if (code === 'AMO_ACCOUNT_ALREADY_EXISTS') {
    return {
      title: 'Компания уже зарегистрирована',
      description: 'Аккаунт amoCRM уже привязан к другой компании TeamOS.',
      action: 'login',
    };
  }
  return {
    title: 'Не удалось проверить токен',
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
