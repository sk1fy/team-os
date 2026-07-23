import { afterEach, describe, expect, it, vi } from 'vitest';
import { academyCoursesApi } from './courses';
import { academyExternalAdminApi } from './externalAdmin';
import { academyExternalPublicApi } from './externalPublic';
import { useAuthStore } from '@/stores/auth';

function jsonResponse(body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ accessToken: null, initialized: false });
});

describe('Academy V2 HTTP contracts', () => {
  it('external outline uses public contract without internal Bearer', async () => {
    useAuthStore.getState().setAccessToken('internal-secret');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    await academyExternalPublicApi.getOutline('enrollment/1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/public/academy/enrollments/enrollment%2F1/outline');
    expect(new Headers(init.headers).get('Authorization')).toBeNull();
    expect(init.credentials).toBe('include');
  });

  it('activation forwards a stable caller idempotency key and empty body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ enrollmentId: 'e1' }));
    vi.stubGlobal('fetch', fetchMock);

    await academyExternalPublicApi.activate('secret', { idempotencyKey: 'activate-key' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('activate-key');
    expect(init.body).toBe('{}');
  });

  it('personal access requires recipient email and uses the planned resource path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    await academyExternalAdminApi.createPersonalAccess('course', 'version', {
      email: 'learner@example.com',
      firstName: 'Иван',
      deadlineDays: 3,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/academy/courses/course/versions/version/personal-accesses');
    expect(JSON.parse(String(init.body))).toMatchObject({
      email: 'learner@example.com',
      deadlineDays: 3,
    });
  });

  it('campaign purpose is backend-defined and lifecycle paths are explicit', async () => {
    // A Response body is single-use. Return a fresh instance for every request
    // because this contract test performs both create and pause mutations.
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    await academyExternalAdminApi.createCampaign('course', 'version', {
      purpose: 'company_candidate',
      name: 'Кандидаты',
      deadlineDays: 3,
    });
    await academyExternalAdminApi.pauseCampaign('campaign');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/academy/courses/course/versions/version/campaigns',
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toMatchObject({
      purpose: 'company_candidate',
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/academy/campaigns/campaign/pause');
  });

  it('partner copy preserves the supplied idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    await academyCoursesApi.copyToCompany(
      'partner-course',
      { versionId: 'v1' },
      { idempotencyKey: 'copy-key' },
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/academy/partner-courses/partner-course/versions/v1/copy-to-company');
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('copy-key');
  });
});
