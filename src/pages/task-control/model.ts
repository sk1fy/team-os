import type { TaskControlRule } from '@/api/taskControl';

// Decoding is only for form routing. Core signature and authorization are verified by backend.
export function readProof(raw: string, purpose: 'link' | 'mode', accountId: string) {
  try {
    const parts = raw.trim().split('.');
    if (parts.length !== 3 || raw.length > 8192) throw new Error();
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const proof = JSON.parse(atob(payload));
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      proof.purpose !== purpose ||
      proof.accountId !== accountId ||
      proof.product !== 'task-control' ||
      proof.aud !== 'teamos-task-control' ||
      !uuid.test(proof.requestId) ||
      !uuid.test(proof.installationId) ||
      !uuid.test(proof.integrationId) ||
      !Number.isFinite(proof.exp) ||
      proof.exp * 1000 <= Date.now()
    )
      throw new Error();
    return proof as { requestId: string; installationId: string; integrationId: string };
  } catch {
    throw new Error(
      'Код истёк, относится к другому аккаунту или действию. Получите новый код в настройках виджета.',
    );
  }
}
export function crmIds(value: string): string[] {
  const ids = value.trim() ? value.trim().split(/[\s,;]+/) : [];
  if (ids.some((id) => !/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    throw new Error('ID amoCRM должны быть положительными целыми числами.');
  }
  return [...new Set(ids)];
}
export function newRule(): TaskControlRule {
  return {
    ruleUid: crypto.randomUUID(),
    name: 'Новое правило',
    users: [],
    pipelines: [],
    customers: false,
    customerStatuses: [],
    showModal: true,
    denyExit: false,
    checkResponsible: true,
    enabled: true,
    archived: false,
  };
}
