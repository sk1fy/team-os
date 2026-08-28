export function createAccessLinkLoginDeduplicator<TSession>(
  login: (token: string) => Promise<TSession>,
) {
  const pendingByToken = new Map<string, Promise<TSession>>();

  return (token: string): Promise<TSession> => {
    const pending = pendingByToken.get(token);
    if (pending) return pending;

    const request = login(token);
    pendingByToken.set(token, request);
    void request.then(
      () => pendingByToken.delete(token),
      () => pendingByToken.delete(token),
    );
    return request;
  };
}
