import { afterEach, describe, expect, it, vi } from 'vitest';
import { academyCoursesApi } from './courses';
import { academyExternalAdminApi } from './externalAdmin';
import { academyExternalPublicApi } from './externalPublic';
import { academyLearningApi } from './learning';
import { academyTemplatesApi } from './templates';
import { academyVersionsApi } from './versions';
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
  it('updates course visibility separately from draft metadata', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'course-1',
          title: 'Курс',
          visibility: 'company',
          sequential: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'draft-1',
          courseId: 'course-1',
          number: 2,
          status: 'draft',
          title: 'Новая версия курса',
          sequential: false,
          defaultInternalDeadlineDays: 14,
          createdById: 'user-1',
          createdAt: '2026-07-28T09:00:00Z',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const course = await academyCoursesApi.update('course-1', { visibility: 'company' });
    const draft = await academyCoursesApi.updateDraft('course-1', {
      title: 'Новая версия курса',
      description: 'Описание',
      sequential: false,
      defaultInternalDeadlineDays: 14,
    });

    const [courseUrl, courseInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(courseUrl).toContain('/academy/courses/course-1');
    expect(courseUrl).not.toContain('/draft');
    expect(courseInit.method).toBe('PATCH');
    expect(JSON.parse(String(courseInit.body))).toEqual({ visibility: 'company' });

    const [draftUrl, draftInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(draftUrl).toContain('/academy/courses/course-1/draft');
    expect(draftInit.method).toBe('PATCH');
    expect(JSON.parse(String(draftInit.body))).toEqual({
      title: 'Новая версия курса',
      description: 'Описание',
      sequential: false,
      defaultInternalDeadlineDays: 14,
    });
    expect(course).toMatchObject({ id: 'course-1', visibility: 'company' });
    expect(draft).toMatchObject({ id: 'draft-1', courseId: 'course-1' });
  });

  it('reads and updates the company course partner audience', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ audience: 'selected_partners', partnerUserIds: ['partner-1'] }),
      )
      .mockResolvedValueOnce(jsonResponse({ audience: 'all_partners', partnerUserIds: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(academyCoursesApi.getPartnerAudience('course-1')).resolves.toEqual({
      audience: 'selected_partners',
      partnerUserIds: ['partner-1'],
    });
    await academyCoursesApi.setPartnerAudience('course-1', {
      audience: 'all_partners',
      partnerUserIds: ['ignored-for-all'],
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/academy/courses/course-1/partner-audience',
    );
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      audience: 'all_partners',
      partnerUserIds: [],
    });
  });

  it('creates a course from selected knowledge-base articles', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'course-from-kb',
        title: 'Регламенты',
        ownerType: 'company',
        currentDraftVersionId: 'draft-1',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await academyCoursesApi.createFromKb({
      title: 'Регламенты',
      mode: 'copy',
      sectionIds: ['section-1'],
      articleIds: ['article-1'],
      visibility: 'restricted',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/academy/courses/from-kb');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({
      mode: 'copy',
      sectionIds: ['section-1'],
      articleIds: ['article-1'],
    });
  });

  it('maps builder section ids to the versioned lesson wire contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'lesson-1',
          courseVersionId: 'version-1',
          sectionVersionId: 'section-1',
          title: 'Урок',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'lesson-1',
          courseVersionId: 'version-1',
          sectionVersionId: 'section-2',
          title: 'Урок',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await academyVersionsApi.createLesson('version-1', {
      sectionId: 'section-1',
      title: 'Урок',
    });
    await academyVersionsApi.moveLesson('lesson-1', {
      sectionId: 'section-2',
      order: 0,
    });

    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      sectionVersionId: 'section-1',
      title: 'Урок',
    });
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      sectionVersionId: 'section-2',
      order: 0,
    });
  });

  it('normalizes the immutable published version number from backend wire', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'published-1',
        courseId: 'course-1',
        number: 2,
        status: 'published',
        title: 'Курс',
        createdAt: '2026-07-27T12:00:00Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      academyVersionsApi.publish('course-1', { idempotencyKey: 'publish-key' }),
    ).resolves.toMatchObject({
      courseId: 'course-1',
      version: { id: 'published-1', versionNumber: 2, status: 'published' },
    });
  });

  it('sends complete corporate template content instead of metadata only', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'template-1',
        templateId: 'template-1',
        number: 1,
        status: 'draft',
        title: 'Шаблон',
        content: { sections: [], lessons: [], quizzes: [] },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await academyTemplatesApi.updateDraft('template-1', {
      title: 'Шаблон',
      sequential: true,
      content: {
        sections: [
          {
            stableKey: 'section-1',
            title: 'Раздел',
            order: 0,
            lessons: [
              {
                stableKey: 'lesson-1',
                title: 'Урок',
                order: 0,
                content: {
                  type: 'doc',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст' }] }],
                },
                quiz: {
                  questions: [
                    {
                      id: 'question-1',
                      type: 'single',
                      text: 'Вопрос',
                      required: true,
                      options: [
                        { id: 'answer-1', text: 'Да', correct: true },
                        { id: 'answer-2', text: 'Нет', correct: false },
                      ],
                    },
                  ],
                  passingScore: 100,
                },
              },
            ],
          },
        ],
      },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/academy/templates/template-1/draft');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toMatchObject({
      content: {
        sections: [
          {
            lessons: [
              {
                content: { type: 'doc' },
                quiz: { passingScore: 100, questions: [{ type: 'single' }] },
              },
            ],
          },
        ],
      },
    });
  });

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

  it('forwards caller idempotency keys for every one-time admin token response', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    await academyExternalAdminApi.createPersonalAccess(
      'course',
      'version',
      { email: 'learner@example.com', deadlineDays: 3 },
      { idempotencyKey: 'create-access-key' },
    );
    await academyExternalAdminApi.rotatePersonalAccess('access', {
      idempotencyKey: 'rotate-access-key',
    });
    await academyExternalAdminApi.repeatPersonalAccess('access', {
      idempotencyKey: 'repeat-access-key',
    });
    await academyExternalAdminApi.createCampaign(
      'course',
      'version',
      { purpose: 'company_candidate', name: 'Кандидаты', deadlineDays: 3 },
      { idempotencyKey: 'create-campaign-key' },
    );
    await academyExternalAdminApi.rotateCampaign('campaign', {
      idempotencyKey: 'rotate-campaign-key',
    });

    expect(
      fetchMock.mock.calls.map(([, init]) =>
        new Headers((init as RequestInit).headers).get('Idempotency-Key'),
      ),
    ).toEqual([
      'create-access-key',
      'rotate-access-key',
      'repeat-access-key',
      'create-campaign-key',
      'rotate-campaign-key',
    ]);
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
