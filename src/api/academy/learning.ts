import type {
  CatalogCourseCard,
  CourseVersionLearnerDetail,
  EnrollmentDetail,
  EnrollmentSummary,
  LessonLearner,
  MyLearningSummary,
  PaginatedResult,
  QuizAttemptAnswer,
  QuizAttemptResult,
} from '@/types/academy';
import type { ID } from '@/types';
import { createId } from '@/lib/id';
import {
  academyGet,
  academyMutate,
  buildQuery,
  encodeId,
  type RequestOptions,
} from './httpHelpers';
import {
  isEnrollmentLike,
  isRecord,
  normalizeEnrollmentSummary,
  normalizeQuizAttempt,
  toWireQuizAnswers,
  type EnrollmentWire,
} from './wireAdapters';

export type { EnrollmentWire } from './wireAdapters';
export { normalizeEnrollmentSummary } from './wireAdapters';

/** Atomic quiz grade payload — attempt + enrollment progress in one response. */
export type QuizSubmitResponse = {
  attempt: QuizAttemptResult;
  progress: EnrollmentProgressSnapshot;
};

type OutlineLessonWire = {
  id: ID;
  lessonId?: ID;
  lessonVersionId?: ID;
  sectionVersionId?: ID;
  title?: string;
  order?: number;
  status?: string;
  locked?: boolean;
  completed?: boolean;
  lockReason?: string;
  hasQuiz?: boolean;
};

type OutlineSectionWire = {
  id: ID;
  sectionId?: ID;
  sectionVersionId?: ID;
  title?: string;
  order?: number;
  lessons?: OutlineLessonWire[];
};

type EnrollmentOutlineWire = {
  enrollment?: EnrollmentWire;
  sections?: OutlineSectionWire[];
};

export type EnrollmentProgressSnapshot = {
  enrollment: EnrollmentWire;
  lessons: {
    lessonVersionId?: ID;
    lessonId?: ID;
    id?: ID;
    status: string;
  }[];
  quizAttempts?: unknown[];
};

function normalizeQuizSubmitResponse(
  wire: unknown,
  context: { enrollmentId: ID; quizId?: ID },
): QuizSubmitResponse {
  const record = isRecord(wire) ? wire : {};
  const progress = isRecord(record.progress) ? record.progress : null;
  if (!progress || !isEnrollmentLike(progress.enrollment)) {
    throw new Error('Ответ теста не содержит атомарный снимок прогресса');
  }
  return {
    attempt: normalizeQuizAttempt(record.attempt, context),
    progress: {
      enrollment: progress.enrollment,
      lessons: Array.isArray(progress.lessons)
        ? progress.lessons.flatMap((lesson) => {
            if (!isRecord(lesson) || typeof lesson.status !== 'string') return [];
            return [
              {
                lessonVersionId:
                  typeof lesson.lessonVersionId === 'string' ? lesson.lessonVersionId : undefined,
                lessonId: typeof lesson.lessonId === 'string' ? lesson.lessonId : undefined,
                id: typeof lesson.id === 'string' ? lesson.id : undefined,
                status: lesson.status,
              },
            ];
          })
        : [],
      quizAttempts: Array.isArray(progress.quizAttempts) ? progress.quizAttempts : [],
    },
  };
}

function buildEnrollmentDetail(
  wire: EnrollmentWire,
  sections: OutlineSectionWire[],
  version: CourseVersionLearnerDetail | null,
): EnrollmentDetail {
  const versionLessons = new Map(
    (version?.sections ?? []).flatMap((section) =>
      section.lessons.map((lesson) => [lesson.id, lesson] as const),
    ),
  );
  const normalizedSections = sections.map((section, sectionIndex) => ({
    id: section.sectionVersionId ?? section.id,
    title: section.title ?? `Раздел ${sectionIndex + 1}`,
    order: section.order ?? sectionIndex,
    lessons: (section.lessons ?? []).map((lesson, lessonIndex) => {
      const lessonVersionId = lesson.lessonVersionId ?? lesson.id;
      const versionLesson = versionLessons.get(lessonVersionId) ?? versionLessons.get(lesson.id);
      const completed = lesson.completed === true || lesson.status === 'completed';
      const locked = lesson.locked === true || lesson.status === 'locked';
      return {
        ...versionLesson,
        id: lessonVersionId,
        sectionId: lesson.sectionVersionId ?? section.sectionVersionId ?? section.id,
        title: lesson.title ?? versionLesson?.title ?? `Урок ${lessonIndex + 1}`,
        order: lesson.order ?? versionLesson?.order ?? lessonIndex,
        locked,
        completed,
        hasQuiz: lesson.hasQuiz ?? versionLesson?.hasQuiz ?? false,
        lockReason: lesson.lockReason ?? versionLesson?.lockReason,
      };
    }),
  }));
  const allLessons = normalizedSections.flatMap((section) => section.lessons);
  const summary = normalizeEnrollmentSummary(wire, {
    courseTitle: version?.title,
    completedLessons: allLessons.filter((lesson) => lesson.completed).length,
    totalLessons: allLessons.length,
  });

  return {
    ...summary,
    outline: {
      id: version?.id ?? wire.courseVersionId,
      courseId: version?.courseId ?? wire.courseId,
      versionNumber: version?.versionNumber ?? 1,
      title: version?.title ?? summary.courseTitle,
      description: version?.description,
      sequential: version?.sequential ?? true,
      sections: normalizedSections,
    },
    canCompleteLessons: summary.accessStatus === 'active',
    canSubmitQuiz: summary.accessStatus === 'active',
    isPreview: false,
  };
}

function normalizeLesson(payload: unknown): LessonLearner {
  const envelope = isRecord(payload) ? payload : {};
  const lesson = isRecord(envelope.lesson) ? envelope.lesson : envelope;
  const enrollment = isRecord(envelope.enrollment) ? envelope.enrollment : {};
  const status = typeof lesson.status === 'string' ? lesson.status : undefined;

  return {
    id: String(lesson.lessonVersionId ?? lesson.id ?? ''),
    courseId: String(lesson.courseId ?? enrollment.courseId ?? ''),
    sectionId: String(lesson.sectionId ?? lesson.sectionVersionId ?? ''),
    versionId: String(
      lesson.versionId ?? lesson.courseVersionId ?? enrollment.courseVersionId ?? '',
    ),
    title: typeof lesson.title === 'string' ? lesson.title : 'Урок',
    order: typeof lesson.order === 'number' ? lesson.order : 0,
    content: isRecord(lesson.content)
      ? (lesson.content as LessonLearner['content'])
      : { type: 'doc', content: [] },
    quiz: isRecord(lesson.quiz) ? (lesson.quiz as unknown as LessonLearner['quiz']) : undefined,
    estimatedMinutes:
      typeof lesson.estimatedMinutes === 'number' ? lesson.estimatedMinutes : undefined,
    locked: lesson.locked === true || status === 'locked',
    completed: lesson.completed === true || status === 'completed',
  };
}

async function getEnrollmentDetail(
  enrollmentId: ID,
  options?: RequestOptions,
): Promise<EnrollmentDetail> {
  const outlinePayload = await academyGet<EnrollmentOutlineWire | EnrollmentDetail>(
    `/academy/enrollments/${encodeId(enrollmentId)}/outline`,
    options,
  );
  if ('outline' in outlinePayload && isRecord(outlinePayload.outline)) {
    return outlinePayload;
  }

  const wirePayload = outlinePayload as EnrollmentOutlineWire;
  const wire = isEnrollmentLike(wirePayload.enrollment)
    ? wirePayload.enrollment
    : await academyGet<EnrollmentWire>(`/academy/enrollments/${encodeId(enrollmentId)}`, options);
  const sections = Array.isArray(wirePayload.sections) ? wirePayload.sections : [];
  const version = await academyGet<CourseVersionLearnerDetail>(
    `/academy/course-versions/${encodeId(wire.courseVersionId)}/learner`,
    options,
  ).catch(() => null);

  return buildEnrollmentDetail(wire, sections, version);
}

export const academyLearningApi = {
  myLearning(options?: RequestOptions): Promise<MyLearningSummary> {
    return academyGet('/academy/learning/me', options);
  },

  myEnrollments(
    filters: { status?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<EnrollmentSummary>> {
    return academyGet(
      `/academy/enrollments/me${buildQuery({
        status: filters.status,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`,
      options,
    );
  },

  catalog(
    filters: { q?: string; page?: number; pageSize?: number } = {},
    options?: RequestOptions,
  ): Promise<PaginatedResult<CatalogCourseCard>> {
    return academyGet(
      `/academy/catalog${buildQuery({
        q: filters.q,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`,
      options,
    );
  },

  getEnrollment(enrollmentId: ID, options?: RequestOptions): Promise<EnrollmentDetail> {
    return getEnrollmentDetail(enrollmentId, options);
  },

  /**
   * Opening a ready/invited internal enrollment is a server-side transition:
   * it activates the enrollment and seeds the first available lesson.
   */
  async openEnrollment(enrollmentId: ID, options?: RequestOptions): Promise<EnrollmentDetail> {
    const enrollment = await getEnrollmentDetail(enrollmentId, options);
    if (enrollment.accessStatus !== 'ready' && enrollment.accessStatus !== 'invited') {
      return enrollment;
    }
    await academyMutate(
      `/academy/enrollments/${encodeId(enrollmentId)}/resume`,
      'POST',
      undefined,
      options,
    );
    return getEnrollmentDetail(enrollmentId, options);
  },

  getLesson(enrollmentId: ID, lessonId: ID, options?: RequestOptions): Promise<LessonLearner> {
    return academyGet<unknown>(
      `/academy/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}`,
      options,
    ).then(normalizeLesson);
  },

  completeLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: RequestOptions,
  ): Promise<EnrollmentProgressSnapshot> {
    return academyMutate<EnrollmentProgressSnapshot>(
      `/academy/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}/complete`,
      'POST',
      {},
      {
        ...options,
        // OpenAPI requires Idempotency-Key (8–255 bytes) on lesson completion.
        idempotencyKey: options?.idempotencyKey ?? createId(),
      },
    );
  },

  /**
   * Server returns EnrollmentQuizAttemptSubmitted: { attempt, progress }.
   * The caller merges progress into its already loaded enrollment detail.
   */
  async submitQuiz(
    enrollmentId: ID,
    quizId: ID,
    input: { answers: QuizAttemptAnswer[] },
    options?: RequestOptions,
  ): Promise<QuizSubmitResponse> {
    const wire = await academyMutate<unknown>(
      `/academy/enrollments/${encodeId(enrollmentId)}/quizzes/${encodeId(quizId)}/attempts`,
      'POST',
      { answers: toWireQuizAnswers(input.answers) },
      {
        ...options,
        idempotencyKey: options?.idempotencyKey ?? createId(),
      },
    );
    return normalizeQuizSubmitResponse(wire, { enrollmentId, quizId });
  },

  async reviewQuizAttempt(
    enrollmentId: ID,
    attemptId: ID,
    input: { passed: boolean; comment?: string },
    options?: RequestOptions,
  ): Promise<QuizSubmitResponse> {
    const wire = await academyMutate<unknown>(
      `/academy/enrollments/${encodeId(enrollmentId)}/quiz-attempts/${encodeId(attemptId)}/review`,
      'POST',
      {
        passed: input.passed,
        ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
      },
      options,
    );
    return normalizeQuizSubmitResponse(wire, { enrollmentId });
  },

  enrollFromCatalog(courseId: ID, options?: RequestOptions): Promise<EnrollmentSummary> {
    return academyMutate(`/academy/catalog/${encodeId(courseId)}/enroll`, 'POST', {}, options);
  },

  /** Resolve active enrollment for legacy /learn/:courseId URLs. */
  resolveEnrollmentForCourse(
    courseId: ID,
    options?: RequestOptions,
  ): Promise<{ enrollmentId: ID }> {
    return academyGet(`/academy/courses/${encodeId(courseId)}/my-enrollment`, options);
  },
};
