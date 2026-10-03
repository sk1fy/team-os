import { httpRequest, jsonBody } from './client';
import type { DealDistributionGroup } from '@/types';
import type { components } from './generated/teamos';
export interface Group extends DealDistributionGroup {
  revision?: number;
}
type Schema = components['schemas'];
export type Rule = Schema['DistributionRuntimeRule'];
export type DistributionObservation = Schema['DistributionObservation'];
export type Connection = Schema['DistributionConnection'];
export type References = Schema['DistributionReferences'];
export type Mapping = Schema['DistributionEmployeeMapping'];
export type Availability = Schema['DistributionRuntimeAvailability'];
export type QueueItem = Schema['DistributionRuntimeQueueItem'] & {
  updatedAt: string;
  actions: string[];
  resultVersion: number | null;
};
export type Summary = Schema['DistributionRuntimeSummary'];
export type History = Schema['DistributionRuntimeHistory'] & { hasMore?: boolean };
export interface QueueFilter {
  tab: string;
  groupId?: string;
  from?: string;
  to?: string;
  offset: number;
}
function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) {
  return httpRequest<T>(
    path,
    { method, signal, body: body === undefined ? undefined : jsonBody(body) },
    { retryInternalRefresh: method === 'GET' },
  );
}
export const distributionRuntimeApi = {
  groups: (signal?: AbortSignal) =>
    request<Group[]>('/distribution/groups', 'GET', undefined, signal),
  createGroup: (body: Schema['CreateDistributionGroupInput']) =>
    request<Group>('/distribution/groups', 'POST', body),
  configureGroup: (id: string, body: Schema['DistributionGroupConfigurationInput']) =>
    request<Group>(`/distribution/groups/${encodeURIComponent(id)}/configuration`, 'PUT', body),
  rules: async (offset = 0, signal?: AbortSignal) => {
    const items: Rule[] = [];
    for (let page = offset; page < 100000; page += 100) {
      const result = await request<{ items: Rule[] }>(
        `/distribution/rules?limit=100&offset=${page}`,
        'GET',
        undefined,
        signal,
      );
      items.push(...result.items);
      if (result.items.length < 100) return { items };
    }
    throw new Error('Слишком много правил: уточните область загрузки.');
  },
  createRule: (body: Schema['DistributionRuleCreateInput']) =>
    request<Rule>('/distribution/rules', 'POST', body),
  updateRule: (id: string, body: Schema['DistributionRuleUpdateInput']) =>
    request<Rule>(`/distribution/rules/${encodeURIComponent(id)}`, 'PUT', body),
  connections: (signal?: AbortSignal) =>
    request<Connection[]>('/distribution/connections', 'GET', undefined, signal),
  references: (binding: string, signal?: AbortSignal) =>
    request<References>(
      `/distribution/references?bindingId=${encodeURIComponent(binding)}`,
      'GET',
      undefined,
      signal,
    ),
  mappings: (binding: string, signal?: AbortSignal) =>
    request<Mapping[]>(
      `/distribution/connections/${encodeURIComponent(binding)}/mappings`,
      'GET',
      undefined,
      signal,
    ),
  observations: async (ruleId: string, offset: number, signal?: AbortSignal) => {
    const result = await request<Schema['DistributionRuntimeObservations']>(
      `/distribution/rules/${encodeURIComponent(ruleId)}/observations?limit=25&offset=${offset}`,
      'GET',
      undefined,
      signal,
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      typeof result.hasMore !== 'boolean' ||
      !Number.isSafeInteger(result.offset) ||
      typeof result.checkedAt !== 'string' ||
      Number.isNaN(Date.parse(result.checkedAt)) ||
      result.items.some(
        (item) =>
          !item ||
          item.ruleId !== ruleId ||
          typeof item.id !== 'string' ||
          typeof item.leadId !== 'string' ||
          typeof item.decisionKind !== 'string' ||
          typeof item.reason !== 'string' ||
          typeof item.checkedAt !== 'string' ||
          Number.isNaN(Date.parse(item.checkedAt)),
      )
    )
      throw new Error(
        'Источник вернул неполные данные наблюдений. Повторите чтение после проверки сервера.',
      );
    return result;
  },
  settings: (signal?: AbortSignal) =>
    request<{ timezone: string; revision: number }>(
      '/distribution/settings',
      'GET',
      undefined,
      signal,
    ),
  timezone: (timezone: string) => request('/distribution/settings', 'PUT', { timezone }),
  availability: (rule: string, signal?: AbortSignal) =>
    request<Availability>(
      `/distribution/rules/${encodeURIComponent(rule)}/availability`,
      'GET',
      undefined,
      signal,
    ),
  summary: (groupId?: string, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (groupId) params.set('groupId', groupId);
    return request<Summary>(`/distribution/summary?${params}`, 'GET', undefined, signal);
  },
  queue: (filter: QueueFilter, signal?: AbortSignal) => {
    const params = new URLSearchParams({
      tab: filter.tab,
      limit: '25',
      offset: String(filter.offset),
    });
    for (const key of ['groupId', 'from', 'to'] as const)
      if (filter[key]) params.set(key, filter[key]);
    return request<{ items: QueueItem[]; hasMore: boolean }>(
      `/distribution/queue?${params}`,
      'GET',
      undefined,
      signal,
    );
  },
  detail: (id: string, signal?: AbortSignal) =>
    request<QueueItem>(`/distribution/queue/${encodeURIComponent(id)}`, 'GET', undefined, signal),
  history: (id: string, offset: number, signal?: AbortSignal) =>
    request<History>(
      `/distribution/queue/${encodeURIComponent(id)}/history?limit=25&offset=${offset}`,
      'GET',
      undefined,
      signal,
    ),
  action: (id: string, body: { action: string; expectedUpdatedAt: string; requestId: string }) =>
    request<QueueItem>(`/distribution/queue/${encodeURIComponent(id)}/actions`, 'POST', body),
};
