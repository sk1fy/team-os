import { describe, expect, it } from 'vitest';
import type { AuthSession } from '@/api/client';
import type { User } from '@/types';
import {
  COMPANY_CREATED_WELCOME_STATE,
  getAccessLinkDestination,
} from './accessLinkNavigation';

const user = {} as User;

describe('getAccessLinkDestination', () => {
  it('направляет владельца новой компании к сотрудникам и передаёт welcome-состояние', () => {
    const session: AuthSession<User> = {
      accessToken: 'access-token',
      user,
      entryContext: 'company_created',
    };

    expect(getAccessLinkDestination(session)).toEqual({
      pathname: '/employees',
      state: COMPANY_CREATED_WELCOME_STATE,
    });
  });

  it('оставляет обычную access-ссылку на маршруте графика', () => {
    expect(getAccessLinkDestination({ accessToken: 'access-token', user })).toEqual({
      pathname: '/schedule',
    });
  });
});
