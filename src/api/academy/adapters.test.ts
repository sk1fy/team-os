import { afterEach, describe, expect, it, vi } from 'vitest';
import { academyCoursesApi } from './courses';
import { academyExternalAdminApi } from './externalAdmin';
import { academyLearningApi } from './learning';
import { academyReportsApi } from './reports';
import { academyTemplatesApi } from './templates';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const enrollmentWire = {
  id: 'enrollment-1',
  courseId: 'course-1',
  courseVersionId: 'version-1',
  currentLessonVersionId: 'lesson-2',
  learnerType: 'user',
  progressStatus: 'in_progress',
  accessStatus: 'active',
  progressPercent: 50,
};

const outlineWire = {
  enrollment: enrollmentWire,
  sections: [
    {
      id: 'section-1',
      title: 'Раздел',
      order: 0,
      lessons: [
        { id: 'lesson-1', title: 'Первый', order: 0, status: 'completed' },
        { id: 'lesson-2', title: 'Второй', order: 1, status: 'current' },
        {
          id: 'lesson-3',
          title: 'Третий',
          order: 2,
          status: 'locked',
          lockReason: 'Сначала завершите предыдущий урок',
        },
      ],
    },
  ],
};

const versionWire = {
  id: 'version-1',
  courseId: 'course-1',
  versionNumber: 2,
  title: 'Тестовый курс',
  sequential: true,
  sections: [
    {
      id: 'section-1',
      title: 'Раздел',
      order: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Первый',
          order: 0,
          locked: false,
          completed: false,
          hasQuiz: false,
        },
        {
          id: 'lesson-2',
          title: 'Второй',
          order: 1,
          locked: false,
          completed: false,
          hasQuiz: true,
        },
        {
          id: 'lesson-3',
          title: 'Третий',
          order: 2,
          locked: false,
          completed: false,
          hasQuiz: false,
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Academy deployed-contract adapters', () => {
  it('преобразует фактический массив системных шаблонов в UI-контракт', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            id: 'template-1',
            type: 'system',
            systemTemplateKey: 'employee-onboarding',
            latestPublishedVersionId: 'version-1',
            lifecycleStatus: 'active',
          },
        ]),
      ),
    );

    await expect(academyTemplatesApi.list({ page: 1, pageSize: 50 })).resolves.toMatchObject({
      page: 1,
      pageSize: 50,
      total: 1,
      items: [
        {
          id: 'template-1',
          ownerType: 'system',
          title: 'Онбординг нового сотрудника',
          latestVersionId: 'version-1',
          archived: false,
          capabilities: {
            canInstantiate: true,
            canEdit: false,
            canArchive: false,
            canPreview: true,
          },
        },
      ],
    });
  });

  it('берёт метаданные detail-шаблона из опубликованной версии', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'template-1',
          type: 'system',
          systemTemplateKey: 'employee-onboarding',
          latestPublishedVersionId: 'version-1',
          lifecycleStatus: 'active',
          versions: [
            {
              id: 'version-1',
              number: 2,
              status: 'published',
              title: 'Адаптация сотрудника',
              description: 'Программа первых рабочих дней.',
            },
          ],
        }),
      ),
    );

    await expect(academyTemplatesApi.get('template-1')).resolves.toMatchObject({
      id: 'template-1',
      ownerType: 'system',
      title: 'Адаптация сотрудника',
      description: 'Программа первых рабочих дней.',
      latestVersionId: 'version-1',
      latestVersionNumber: 2,
    });
  });

  it('преобразует массив курсов и фактические идентификаторы версий', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/draft')) {
          return jsonResponse({
            id: 'draft-1',
            courseId: 'course-1',
            versionNumber: 1,
            status: 'draft',
            title: 'Тестовый курс',
            sections: [{ id: 'section-1', title: 'Раздел', order: 0, lessons: null }],
          });
        }
        return jsonResponse([
          {
            id: 'course-1',
            authorId: 'user-1',
            title: 'Тестовый курс',
            currentDraftVersionId: 'draft-1',
            latestPublishedVersionId: 'published-1',
          },
        ]);
      }),
    );

    const courses = await academyCoursesApi.list({ page: 1, pageSize: 30 });
    const draft = await academyCoursesApi.getDraft('course-1');

    expect(courses.items[0]).toMatchObject({
      id: 'course-1',
      ownerUserId: 'user-1',
      draftVersion: { id: 'draft-1', status: 'draft' },
      latestPublishedVersion: { id: 'published-1', status: 'published' },
    });
    expect(draft.sections[0]?.lessons).toEqual([]);
  });

  it('собирает enrollment detail из отдельных enrollment outline и version ресурсов', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/outline')) return jsonResponse(outlineWire);
        if (url.includes('/course-versions/version-1/learner')) return jsonResponse(versionWire);
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const enrollment = await academyLearningApi.getEnrollment('enrollment-1');

    expect(enrollment).toMatchObject({
      id: 'enrollment-1',
      courseTitle: 'Тестовый курс',
      percent: 50,
      completedLessons: 1,
      totalLessons: 3,
      currentLessonId: 'lesson-2',
    });
    expect(enrollment.outline.sections[0]?.lessons).toEqual([
      expect.objectContaining({ id: 'lesson-1', completed: true, locked: false }),
      expect.objectContaining({ id: 'lesson-2', completed: false, locked: false, hasQuiz: true }),
      expect.objectContaining({
        id: 'lesson-3',
        completed: false,
        locked: true,
        lockReason: 'Сначала завершите предыдущий урок',
      }),
    ]);
  });

  it('распаковывает lesson из фактической server envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          enrollment: enrollmentWire,
          lesson: {
            id: 'lesson-2',
            courseVersionId: 'version-1',
            sectionVersionId: 'section-1',
            title: 'Второй',
            order: 1,
            status: 'current',
            content: { type: 'doc', content: [] },
          },
        }),
      ),
    );

    await expect(academyLearningApi.getLesson('enrollment-1', 'lesson-2')).resolves.toMatchObject({
      id: 'lesson-2',
      courseId: 'course-1',
      sectionId: 'section-1',
      versionId: 'version-1',
      title: 'Второй',
      locked: false,
      completed: false,
    });
  });

  it('преобразует массив внешних учеников в пагинированный результат', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            id: 'learner-1',
            email: 'learner@example.com',
            companyId: 'company-1',
            firstSeenAt: '2026-07-23T00:00:00Z',
            enrollmentCount: 1,
            completedCount: 0,
          },
        ]),
      ),
    );

    await expect(
      academyExternalAdminApi.listLearners({ page: 1, pageSize: 25 }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
      items: [expect.objectContaining({ id: 'learner-1' })],
    });
  });

  it('преобразует поле lessons отчёта в lessonResults и добавляет названия', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/report')) {
          return jsonResponse({
            enrollment: enrollmentWire,
            lessons: [
              { lessonVersionId: 'lesson-1', status: 'completed' },
              { lessonVersionId: 'lesson-2', status: 'current' },
            ],
            quizAttempts: [],
          });
        }
        if (url.includes('/outline')) return jsonResponse(outlineWire);
        if (url.includes('/course-versions/version-1/learner')) return jsonResponse(versionWire);
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const report = await academyReportsApi.enrollment('enrollment-1');

    expect(report.enrollment.courseTitle).toBe('Тестовый курс');
    expect(report.lessonResults).toEqual([
      expect.objectContaining({ lessonId: 'lesson-1', title: 'Первый', completed: true }),
      expect.objectContaining({ lessonId: 'lesson-2', title: 'Второй', completed: false }),
    ]);
    expect(report.quizAttempts).toEqual([]);
  });
});
