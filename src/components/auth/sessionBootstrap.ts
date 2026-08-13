export async function restoreAuthenticatedSession(
  refresh: () => Promise<boolean>,
  loadCurrentUser: () => Promise<unknown>,
): Promise<void> {
  if (await refresh()) await loadCurrentUser();
}
