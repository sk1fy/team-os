import { httpRequest, jsonBody } from './client';
import type { components } from './generated/teamos';
export type ActivityPanel = components['schemas']['ActivityPanel'];
export type ActivityPanelInput = components['schemas']['ActivityPanelInput'];
export type ActivityTaskPanel = components['schemas']['ActivityTaskPanel'];
export type ActivityDirectory = components['schemas']['ActivityDirectory'];
export type ActivityScope = components['schemas']['ActivityScope'];
export type ActivityConnection = components['schemas']['ActivityConnection'];
function scopedClient(bindingId: string) {
  function read<T>(path: string, signal?: AbortSignal) {
    return httpRequest<T>(path, { signal, headers: { 'X-Activity-Binding-Id': bindingId } });
  }
  function write<T>(path: string, method: string, body?: unknown, commandId?: string) {
    return httpRequest<T>(
      path,
      {
        method,
        body: body === undefined ? undefined : jsonBody(body),
        headers: {
          'X-Activity-Binding-Id': bindingId,
          ...(commandId ? { 'Idempotency-Key': commandId } : {}),
        },
      },
      { retryInternalRefresh: false },
    );
  }
  return {
    panels: (signal?: AbortSignal) =>
      read<components['schemas']['ActivityPanels']>('/activity-control/panels', signal),
    employees: (signal?: AbortSignal) =>
      read<ActivityDirectory>('/activity-control/employees', signal),
    taskPanel: (signal?: AbortSignal) =>
      read<ActivityTaskPanel>('/activity-control/task-panel', signal),
    create: (input: ActivityPanelInput, commandId: string) =>
      write<ActivityPanel>('/activity-control/panels', 'POST', input, commandId),
    update: (id: string, input: components['schemas']['ActivityPanelPatch']) =>
      write<ActivityPanel>(`/activity-control/panels/${encodeURIComponent(id)}`, 'PATCH', input),
    rotate: (id: string, commandId: string) =>
      write<ActivityPanel>(
        `/activity-control/panels/${encodeURIComponent(id)}/share-link`,
        'POST',
        undefined,
        commandId,
      ),
    saveTaskPanel: (input: ActivityTaskPanel) =>
      write<ActivityTaskPanel>('/activity-control/task-panel', 'PATCH', input),
  };
}
export const activityControlApi = {
  connection: (signal?: AbortSignal) =>
    httpRequest<ActivityConnection>('/activity-control/connection', { signal }),
  forBinding: scopedClient,
};
