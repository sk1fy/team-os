import { describe, expect, it } from 'vitest';
import { orgApi } from '@/api';

describe('mock employee access targets', () => {
  it('не позволяет отозвать доступ владельца', async () => {
    await expect(orgApi.revokeUserAccess('user-1')).rejects.toMatchObject({ status: 400 });
  });

  it('не позволяет выдать доступ неактивному пользователю', async () => {
    await expect(orgApi.setUserLinkAccess('user-7')).rejects.toMatchObject({ status: 400 });
    await expect(orgApi.setUserPasswordAccess('user-9', {})).rejects.toMatchObject({ status: 400 });
  });
});
