import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import {
  activationStateError,
  companyStatusError,
  publicAuthErrorView,
  validateActivationPasswords,
} from './publicAuthFlow';
import { claimOneTimeRequest, withoutOneTimeToken } from './useOneTimeQueryToken';

describe('public auth flow', () => {
  it('удаляет только одноразовый токен из URL', () => {
    const result = withoutOneTimeToken(
      new URLSearchParams('source=amo&token=one-time-secret&returnTo=%2Fschedule'),
    );

    expect(result.get('token')).toBeNull();
    expect(result.toString()).toBe('source=amo&returnTo=%2Fschedule');
  });

  it('разрешает только один запрос при повторном эффекте Strict Mode', () => {
    const started = { current: false };

    expect(claimOneTimeRequest(started)).toBe(true);
    expect(claimOneTimeRequest(started)).toBe(false);
  });

  it('проверяет длину и совпадение паролей до отправки', () => {
    expect(validateActivationPasswords('short', 'short')).toContain('8');
    expect(validateActivationPasswords('long-password', 'another-password')).toBe(
      'Пароли не совпадают',
    );
    expect(validateActivationPasswords('long-password', 'long-password')).toBeUndefined();
  });

  it.each([
    ['BOOTSTRAP_EXPIRED', 'Срок действия ссылки истёк', 'none'],
    ['SSO_CONSUMED', 'Ссылка уже использована', 'login'],
    ['EXTERNAL_USER_DEACTIVATED', 'Нет доступа к TeamOS', 'none'],
    ['INTEGRATION_FROZEN', 'TeamOS временно недоступен', 'none'],
  ] as const)('показывает стабильный код %s без разбора сообщения', (code, title, action) => {
    const result = publicAuthErrorView(new ApiError('Произвольный текст', 409, { code }));

    expect(result).toMatchObject({ title, action });
  });

  it('предлагает повторить сетевую ошибку', () => {
    expect(publicAuthErrorView(new TypeError('Failed to fetch')).action).toBe('retry');
  });

  it('преобразует канонические состояния backend в ошибки страницы', () => {
    expect(activationStateError('pending')).toBeUndefined();
    expect(activationStateError('expired')?.code).toBe('BOOTSTRAP_EXPIRED');
    expect(activationStateError('consumed')?.code).toBe('BOOTSTRAP_CONSUMED');
    expect(companyStatusError('frozen')?.code).toBe('COMPANY_FROZEN');
  });
});
