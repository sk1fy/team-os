import { afterEach, describe, expect, it, vi } from 'vitest';
import { academyCoursesApi } from './courses';
import { academyExternalAdminApi } from './externalAdmin';
import { academyExternalPublicApi } from './externalPublic';
import { academyLearningApi } from './learning';
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
    // OpenAPI ExternalEnrollment uses `id`, not enrollmentId.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'e1',
        companyId: 'co1',
        courseId: 'c1',
        courseVersionId: 'v1',
        versionNumber: 1,
        learnerType: 'external',
        externalLearnerId: 'learner-1',
        sourceType: 'personal_access',
        attemptNumber: 1,
        progressStatus: 'not_started',
        accessStatus: 'active',
        progressPercent: 0,
        createdAt: '2026-07-24T10:00:00Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      academyExternalPublicApi.activate('secret', { idempotencyKey: 'activate-key' }),
    ).resolves.toEqual({ enrollmentId: 'e1' });

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

  it('partner copy preserves the supplied idempotency key and unpacks course id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        course: { id: 'company-copy', title: 'Копия', authorId: 'owner-1' },
        draft: {
          id: 'draft-1',
          courseId: 'company-copy',
          versionNumber: 1,
          status: 'draft',
          title: 'Копия',
          sections: [],
        },
        origin: {
          type: 'partner_copy',
          sourceCourseId: 'partner-course',
          sourceCourseVersionId: 'v1',
          instantiatedById: 'owner-1',
          instantiatedAt: '2026-07-24T10:00:00Z',
          acquisitionType: 'free_copy',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      academyCoursesApi.copyToCompany(
        'partner-course',
        { versionId: 'v1' },
        { idempotencyKey: 'copy-key' },
      ),
    ).resolves.toMatchObject({ id: 'company-copy' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/academy/partner-courses/partner-course/versions/v1/copy-to-company');
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('copy-key');
  });

  it('personal access create unpacks {access,token} and extend sends deadlineDays', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          access: {
            id: 'pa1',
            courseId: 'course',
            courseVersionId: 'version',
            expectedEmail: 'learner@example.com',
            deadlineDays: 3,
            status: 'issued',
            issuedAt: '2026-07-24T10:00:00Z',
          },
          token: 'one-time-personal-token-secret-32',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'pa1',
          courseId: 'course',
          courseVersionId: 'version',
          expectedEmail: 'learner@example.com',
          deadlineDays: 5,
          status: 'activated',
          issuedAt: '2026-07-24T10:00:00Z',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const created = await academyExternalAdminApi.createPersonalAccess('course', 'version', {
      email: 'learner@example.com',
      deadlineDays: 3,
    });
    expect(created.oneTimeToken).toBe('one-time-personal-token-secret-32');
    expect(created.publicUrl).toContain('/training/one-time-personal-token-secret-32');

    await academyExternalAdminApi.extendPersonalAccess('pa1', { deadlineDays: 5 });
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      deadlineDays: 5,
    });
  });

  it('resolve restriction sends required reason body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'restriction-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await academyCoursesApi.resolveRestriction('course-1', { reason: 'Проверено' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/academy/courses/course-1/restrictions/resolve');
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'Проверено' });
  });

  it('reviews a pending open-answer attempt through the canonical endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        attempt: {
          id: 'attempt-1',
          enrollmentId: 'enrollment-1',
          quizVersionId: 'quiz-1',
          attemptNumber: 1,
          answers: [{ questionId: 'question-1', text: 'Развёрнутый ответ' }],
          score: 100,
          passed: true,
          pendingReview: false,
          createdAt: '2026-07-24T10:00:00Z',
        },
        progress: {
          enrollment: {
            id: 'enrollment-1',
            courseId: 'course-1',
            courseVersionId: 'version-1',
            progressStatus: 'completed',
            accessStatus: 'active',
            progressPercent: 100,
          },
          lessons: [],
          quizAttempts: [],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await academyLearningApi.reviewQuizAttempt('enrollment-1', 'attempt-1', {
      passed: true,
      comment: 'Ответ корректный',
    });

    expect(result.attempt).toMatchObject({
      attemptId: 'attempt-1',
      passed: true,
      pendingReview: false,
      answers: [
        {
          questionId: 'question-1',
          openText: 'Развёрнутый ответ',
        },
      ],
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/academy/enrollments/enrollment-1/quiz-attempts/attempt-1/review');
    expect(JSON.parse(String(init.body))).toEqual({
      passed: true,
      comment: 'Ответ корректный',
    });
  });
});
