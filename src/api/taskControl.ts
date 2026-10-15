// API Контроля задач. Записи не повторяются автоматически.
import { httpRequest, jsonBody } from './client';
import type { operations, components } from './generated/teamos';

export type TaskControlRule = components['schemas']['TaskControlRule'];
export type TaskControlConnection = components['schemas']['TaskControlConnection'];
export type TaskControlDraft = components['schemas']['TaskControlDraft'];
export type TaskControlPublication = components['schemas']['TaskControlPublication'];
type Result<K extends keyof operations> = operations[K] extends {
  responses: { 200: { content: { 'application/json': infer T } } };
}
  ? T
  : never;
function request<T>(path: string, method: string, body?: unknown, signal?: AbortSignal) {
  return httpRequest<T>(
    path,
    {
      method,
      signal,
      body: body === undefined ? undefined : jsonBody(body),
    },
    { retryInternalRefresh: method === 'GET' },
  );
}

export const taskControlApi = {
  getTaskControlConnections: (signal?: AbortSignal) =>
    request<Result<'getTaskControlConnections'>>(
      `/task-control/connections`,
      'GET',
      undefined,
      signal,
    ),
  createTaskControlLinkIntent: (
    body: operations['createTaskControlLinkIntent']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'createTaskControlLinkIntent'>>(
      `/task-control/connections/link-intents`,
      'POST',
      body,
      signal,
    ),
  getTaskControlIntent: (intentId: string, signal?: AbortSignal) =>
    request<Result<'getTaskControlIntent'>>(
      `/task-control/intents/${encodeURIComponent(intentId)}`,
      'GET',
      undefined,
      signal,
    ),
  createTaskControlModeIntent: (
    bindingId: string,
    body: operations['createTaskControlModeIntent']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'createTaskControlModeIntent'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/mode-intents`,
      'POST',
      body,
      signal,
    ),
  revokeTaskControlConnection: (
    bindingId: string,
    body: operations['revokeTaskControlConnection']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'revokeTaskControlConnection'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/revoke`,
      'POST',
      body,
      signal,
    ),
  getTaskControlReferences: (bindingId: string, signal?: AbortSignal) =>
    request<Result<'getTaskControlReferences'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/references`,
      'GET',
      undefined,
      signal,
    ),
  getTaskControlDraft: (bindingId: string, signal?: AbortSignal) =>
    request<Result<'getTaskControlDraft'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/draft`,
      'GET',
      undefined,
      signal,
    ),
  updateTaskControlDraft: (
    bindingId: string,
    body: operations['updateTaskControlDraft']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'updateTaskControlDraft'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/draft`,
      'PUT',
      body,
      signal,
    ),
  validateTaskControlDraft: (
    bindingId: string,
    body: operations['validateTaskControlDraft']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'validateTaskControlDraft'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/validate`,
      'POST',
      body,
      signal,
    ),
  publishTaskControlDraft: (
    bindingId: string,
    body: operations['publishTaskControlDraft']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'publishTaskControlDraft'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/publications`,
      'POST',
      body,
      signal,
    ),
  getTaskControlPublications: (
    bindingId: string,
    query: NonNullable<operations['getTaskControlPublications']['parameters']['query']> = {},
    signal?: AbortSignal,
  ) =>
    request<Result<'getTaskControlPublications'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/publications` +
        '?' +
        new URLSearchParams({
          ...(query.cursor ? { cursor: query.cursor } : {}),
          ...(query.limit !== undefined ? { limit: String(query.limit) } : {}),
        }).toString(),
      'GET',
      undefined,
      signal,
    ),
  getTaskControlPublication: (bindingId: string, publicationId: string, signal?: AbortSignal) =>
    request<Result<'getTaskControlPublication'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/publications/${encodeURIComponent(publicationId)}`,
      'GET',
      undefined,
      signal,
    ),
  rollbackTaskControlPublication: (
    bindingId: string,
    body: operations['rollbackTaskControlPublication']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'rollbackTaskControlPublication'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/rollback`,
      'POST',
      body,
      signal,
    ),
  previewTaskControlImport: (
    bindingId: string,
    body: operations['previewTaskControlImport']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'previewTaskControlImport'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/imports`,
      'POST',
      body,
      signal,
    ),
  getTaskControlImport: (bindingId: string, importId: string, signal?: AbortSignal) =>
    request<Result<'getTaskControlImport'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/imports/${encodeURIComponent(importId)}`,
      'GET',
      undefined,
      signal,
    ),
  applyTaskControlImport: (
    bindingId: string,
    importId: string,
    body: operations['applyTaskControlImport']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'applyTaskControlImport'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/imports/${encodeURIComponent(importId)}/apply`,
      'POST',
      body,
      signal,
    ),
  getTaskControlHistory: (
    bindingId: string,
    query: NonNullable<operations['getTaskControlHistory']['parameters']['query']> = {},
    signal?: AbortSignal,
  ) =>
    request<Result<'getTaskControlHistory'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/history` +
        '?' +
        new URLSearchParams({
          ...(query.cursor ? { cursor: query.cursor } : {}),
          ...(query.limit !== undefined ? { limit: String(query.limit) } : {}),
        }).toString(),
      'GET',
      undefined,
      signal,
    ),
  getTaskControlApplicationStatus: (
    bindingId: string,
    publicationId: string,
    signal?: AbortSignal,
  ) =>
    request<Result<'getTaskControlApplicationStatus'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/publications/${encodeURIComponent(publicationId)}/application`,
      'GET',
      undefined,
      signal,
    ),
  getTaskControlInstallation: (accountId: string, signal?: AbortSignal) =>
    request<Result<'getTaskControlInstallation'>>(
      `/task-control/accounts/${encodeURIComponent(accountId)}/installation`,
      'GET',
      undefined,
      signal,
    ),
  createTaskControlSourceRequest: (
    bindingId: string,
    body: operations['createTaskControlSourceRequest']['requestBody']['content']['application/json'],
    signal?: AbortSignal,
  ) =>
    request<Result<'createTaskControlSourceRequest'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/source-requests`,
      'POST',
      body,
      signal,
    ),
  getTaskControlSourceRequest: (bindingId: string, sourceRequestId: string, signal?: AbortSignal) =>
    request<Result<'getTaskControlSourceRequest'>>(
      `/task-control/connections/${encodeURIComponent(bindingId)}/source-requests/${encodeURIComponent(sourceRequestId)}`,
      'GET',
      undefined,
      signal,
    ),
};
