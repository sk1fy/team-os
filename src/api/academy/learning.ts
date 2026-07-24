import type {
  CatalogCourseCard,
  CourseVersionLearnerDetail,
  EnrollmentDetail,
  EnrollmentAccessStatus,
  EnrollmentProgressStatus,
  EnrollmentSummary,
  LessonLearner,
  MyLearningSummary,
  PaginatedResult,
  QuizAttemptAnswer,
  QuizAttemptResult,
} from '@/types/academy';
import type { ID } from '@/types';
import {
  academyGet,
  academyMutate,
  buildQuery,
  encodeId,
  type RequestOptions,
} from './httpHelpers';

/** Atomic quiz grade payload — attempt + enrollment progress in one response. */
export type QuizSubmitResponse = {
  attempt: QuizAttemptResult;
  enrollment: EnrollmentDetail;
};

export type EnrollmentWire = Partial<EnrollmentSummary> & {
  id: ID;
  courseId: ID;
  courseVersionId: ID;
  progressPercent?: number;
  currentLessonVersionId?: ID;
};

type OutlineLessonWire = {
  id: ID;
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
    lessonVersionId: ID;
    status: string;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnrollmentWire(value: unknown): value is EnrollmentWire {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.courseId === 'string' &&
    typeof value.courseVersionId === 'string'
  );
}

function progressStatus(value: unknown): EnrollmentProgressStatus {
  return value === 'in_progress' || value === 'completed' ? value : 'not_started';
}

function accessStatus(value: unknown): EnrollmentAccessStatus {
  return value === 'invited' ||
    value === 'ready' ||
    value === 'expired' ||
    value === 'frozen' ||
    value === 'suspended' ||
    value === 'revoked' ||
    value === 'closed'
    ? value
    : 'active';
}

export function normalizeEnrollmentSummary(
  wire: EnrollmentWire,
  options: { courseTitle?: string; completedLessons?: number; totalLessons?: number } = {},
): EnrollmentSummary {
  return {
    ...wire,
    id: wire.id,
    courseId: wire.courseId,
    courseVersionId: wire.courseVersionId,
    courseTitle: wire.courseTitle ?? options.courseTitle ?? 'Курс',
    learnerType: wire.learnerType === 'external' ? 'external' : 'user',
    progressStatus: progressStatus(wire.progressStatus),
    accessStatus: accessStatus(wire.accessStatus),
    percent: wire.percent ?? wire.progressPercent ?? 0,
    completedLessons: wire.completedLessons ?? options.completedLessons ?? 0,
    totalLessons: wire.totalLessons ?? options.totalLessons ?? 0,
    currentLessonId: wire.currentLessonId ?? wire.currentLessonVersionId,
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
    id: section.id,
    title: section.title ?? `Раздел ${sectionIndex + 1}`,
    order: section.order ?? sectionIndex,
    lessons: (section.lessons ?? []).map((lesson, lessonIndex) => {
      const versionLesson = versionLessons.get(lesson.id);
      const completed = lesson.completed === true || lesson.status === 'completed';
      const locked = lesson.locked === true || lesson.status === 'locked';
      return {
        ...versionLesson,
        id: lesson.id,
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
    id: String(lesson.id ?? ''),
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

  async getEnrollment(enrollmentId: ID, options?: RequestOptions): Promise<EnrollmentDetail> {
    const outlinePayload = await academyGet<EnrollmentOutlineWire | EnrollmentDetail>(
      `/academy/enrollments/${encodeId(enrollmentId)}/outline`,
      options,
    );
    if ('outline' in outlinePayload && isRecord(outlinePayload.outline)) {
      return outlinePayload;
    }

    const wirePayload = outlinePayload as EnrollmentOutlineWire;
    const wire = isEnrollmentWire(wirePayload.enrollment)
      ? wirePayload.enrollment
      : await academyGet<EnrollmentWire>(`/academy/enrollments/${encodeId(enrollmentId)}`, options);
    const sections = Array.isArray(wirePayload.sections) ? wirePayload.sections : [];
    const version = await academyGet<CourseVersionLearnerDetail>(
      `/academy/course-versions/${encodeId(wire.courseVersionId)}/learner`,
      options,
    ).catch(() => null);

    return buildEnrollmentDetail(wire, sections, version);
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
      options,
    );
  },

  /**
   * Server grades the attempt and atomically updates lesson completion / unlock.
   * Do not call completeLesson separately after a passed quiz.
   */
  submitQuiz(
    enrollmentId: ID,
    quizId: ID,
    input: { answers: QuizAttemptAnswer[] },
    options?: RequestOptions,
  ): Promise<QuizSubmitResponse> {
    return academyMutate<{ attempt: QuizAttemptResult }>(
      `/academy/enrollments/${encodeId(enrollmentId)}/quizzes/${encodeId(quizId)}/attempts`,
      'POST',
      input,
      options,
    ).then(async ({ attempt }) => ({
      attempt,
      enrollment: await academyLearningApi.getEnrollment(enrollmentId, options),
    }));
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
