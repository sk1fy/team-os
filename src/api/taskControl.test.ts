import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, httpRequest } from './client';
import { taskControlApi } from './taskControl';

vi.mock('./client', async (load) => {
  const actual = await load<typeof import('./client')>();
  return { ...actual, httpRequest: vi.fn() };
});

describe('Контроль задач: прямой API TeamOS', () => {
  beforeEach(() => {
    vi.mocked(httpRequest).mockReset();
  });

  it('сохраняет неизвестный статус установки вместо превращения его в отключение', async () => {
    const state = { accountId: '123', state: 'unknown' };
    vi.mocked(httpRequest).mockResolvedValue(state);
    expect(await taskControlApi.getTaskControlInstallation('123')).toBe(state);
    expect(httpRequest).toHaveBeenCalledWith(
      '/task-control/accounts/123/installation',
      expect.objectContaining({ method: 'GET' }),
      { retryInternalRefresh: true },
    );
  });

  it('не повторяет публикацию после неопределённой ошибки и сохраняет ключ и fence', async () => {
    const error = new ApiError('Сервис временно недоступен', 503);
    vi.mocked(httpRequest).mockRejectedValue(error);
    const body = {
      requestId: 'a0000000-0000-4000-8000-000000000001',
      expectedBindingRevision: 3,
      expectedModeEpoch: 2,
      expectedDraftRevision: 7,
      expectedChecksum: 'a'.repeat(64),
      reason: 'Публикация',
    };
    await expect(taskControlApi.publishTaskControlDraft('binding', body)).rejects.toBe(error);
    expect(httpRequest).toHaveBeenCalledTimes(1);
    expect(httpRequest).toHaveBeenCalledWith(
      '/task-control/connections/binding/publications',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
      { retryInternalRefresh: false },
    );
  });
});
