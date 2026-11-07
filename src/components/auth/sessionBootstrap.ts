import { ApiError, type RefreshOutcome } from '@/api/client';

export async function restoreAuthenticatedSession(
  refresh: () => Promise<boolean | RefreshOutcome>,
  loadCurrentUser: () => Promise<unknown>,
): Promise<RefreshOutcome> {
  try {
    const result = await refresh();
    const outcome: RefreshOutcome =
      typeof result === 'boolean' ? { kind: result ? 'ready' : 'signed-out' } : result;
    if (outcome.kind === 'ready') await loadCurrentUser();
    return outcome;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { kind: 'signed-out' };
    return {
      kind: 'unavailable',
      error:
        error instanceof ApiError
          ? error
          : new ApiError('Не удалось проверить доступ. Попробуйте ещё раз.', 503),
    };
  }
}
