import type {
  CourseVersionAuthorDetail,
  CourseVersionLearnerDetail,
  CourseVersionSummary,
  LessonAuthor,
  QuizAuthor,
  SectionAuthor,
} from '@/types/academy';
import type { ID, RichTextContent } from '@/types';
import { academyGet, academyMutate, encodeId, type RequestOptions } from './httpHelpers';

type SectionAuthorWire = SectionAuthor & {
  sectionVersionId?: ID;
  courseVersionId?: ID;
};

type LessonAuthorWire = LessonAuthor & {
  lessonVersionId?: ID;
  sectionVersionId?: ID;
  courseVersionId?: ID;
};

type CourseVersionSummaryWire = Partial<CourseVersionSummary> & {
  id: ID;
  courseId: ID;
  number?: number;
};

function normalizeVersionSummary(version: CourseVersionSummaryWire): CourseVersionSummary {
  return {
    ...version,
    id: version.id,
    courseId: version.courseId,
    versionNumber: version.versionNumber ?? version.number ?? 1,
    status: version.status ?? 'draft',
    title: version.title ?? 'Курс',
    createdAt: version.createdAt ?? '',
    updatedAt: version.updatedAt ?? version.createdAt ?? '',
  };
}

function normalizeSection(section: SectionAuthorWire): SectionAuthor {
  return {
    ...section,
    id: section.sectionVersionId ?? section.id,
    versionId: section.courseVersionId ?? section.versionId,
  };
}

function normalizeLesson(lesson: LessonAuthorWire): LessonAuthor {
  return {
    ...lesson,
    id: lesson.lessonVersionId ?? lesson.id,
    sectionId: lesson.sectionVersionId ?? lesson.sectionId,
    versionId: lesson.courseVersionId ?? lesson.versionId,
  };
}

/** Paths aligned with backend-plan §11.1–11.2 (course-versions content). */
export const academyVersionsApi = {
  list(courseId: ID, options?: RequestOptions): Promise<CourseVersionSummary[]> {
    return academyGet<CourseVersionSummaryWire[]>(
      `/academy/courses/${encodeId(courseId)}/versions`,
      options,
    ).then((versions) => versions.map(normalizeVersionSummary));
  },

  getAuthor(
    courseId: ID,
    versionId: ID,
    options?: RequestOptions,
  ): Promise<CourseVersionAuthorDetail> {
    return academyGet(
      `/academy/courses/${encodeId(courseId)}/versions/${encodeId(versionId)}`,
      options,
    );
  },

  getLearner(versionId: ID, options?: RequestOptions): Promise<CourseVersionLearnerDetail> {
    return academyGet(`/academy/course-versions/${encodeId(versionId)}/learner`, options);
  },

  publish(
    courseId: ID,
    options?: RequestOptions,
  ): Promise<{ courseId: ID; version: CourseVersionSummary }> {
    return academyMutate<CourseVersionSummaryWire>(
      `/academy/courses/${encodeId(courseId)}/publish`,
      'POST',
      {},
      options,
    ).then((version) => ({ courseId, version: normalizeVersionSummary(version) }));
  },

  createSection(
    versionId: ID,
    input: { title: string },
    options?: RequestOptions,
  ): Promise<SectionAuthor> {
    return academyMutate<SectionAuthorWire>(
      `/academy/course-versions/${encodeId(versionId)}/sections`,
      'POST',
      input,
      options,
    ).then(normalizeSection);
  },

  updateSection(
    sectionId: ID,
    input: { title?: string; order?: number },
    options?: RequestOptions,
  ): Promise<SectionAuthor> {
    return academyMutate<SectionAuthorWire>(
      `/academy/course-version-sections/${encodeId(sectionId)}`,
      'PATCH',
      input,
      options,
    ).then(normalizeSection);
  },

  deleteSection(sectionId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate<void>(
      `/academy/course-version-sections/${encodeId(sectionId)}`,
      'DELETE',
      undefined,
      options,
    );
  },

  createLesson(
    versionId: ID,
    input: {
      sectionId: ID;
      title: string;
      content?: RichTextContent;
      sourceArticleId?: ID;
      sourceMode?: 'link' | 'copy';
      sourceArticleVersion?: number;
    },
    options?: RequestOptions,
  ): Promise<LessonAuthor> {
    return academyMutate<LessonAuthorWire>(
      `/academy/course-versions/${encodeId(versionId)}/lessons`,
      'POST',
      {
        sectionVersionId: input.sectionId,
        title: input.title,
        content: input.content,
        sourceType:
          input.sourceMode === 'link'
            ? 'kb_link'
            : input.sourceMode === 'copy'
              ? 'kb_snapshot'
              : undefined,
        sourceArticleId: input.sourceArticleId,
        sourceArticleVersion: input.sourceArticleVersion,
      },
      options,
    ).then(normalizeLesson);
  },

  updateLesson(
    lessonId: ID,
    input: {
      title?: string;
      content?: RichTextContent;
      sourceArticleId?: ID | null;
      sourceMode?: 'link' | 'copy' | null;
    },
    options?: RequestOptions,
  ): Promise<LessonAuthor> {
    return academyMutate<LessonAuthorWire>(
      `/academy/course-version-lessons/${encodeId(lessonId)}`,
      'PATCH',
      {
        title: input.title,
        content: input.content,
        sourceType:
          input.sourceMode === 'link'
            ? 'kb_link'
            : input.sourceMode === 'copy'
              ? 'kb_snapshot'
              : input.sourceMode === null
                ? 'manual'
                : undefined,
        sourceArticleId: input.sourceArticleId ?? undefined,
      },
      options,
    ).then(normalizeLesson);
  },

  deleteLesson(lessonId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(
      `/academy/course-version-lessons/${encodeId(lessonId)}`,
      'DELETE',
      undefined,
      options,
    );
  },

  moveLesson(
    lessonId: ID,
    input: { sectionId: ID; order: number },
    options?: RequestOptions,
  ): Promise<LessonAuthor> {
    return academyMutate<LessonAuthorWire>(
      `/academy/course-version-lessons/${encodeId(lessonId)}/move`,
      'POST',
      { sectionVersionId: input.sectionId, order: input.order },
      options,
    ).then(normalizeLesson);
  },

  upsertQuiz(
    lessonId: ID,
    input: Omit<QuizAuthor, 'id' | 'lessonId' | 'maxAttempts'> & {
      id?: ID;
      maxAttempts?: number | null;
    },
    options?: RequestOptions,
  ): Promise<QuizAuthor> {
    return academyMutate(
      `/academy/course-version-lessons/${encodeId(lessonId)}/quiz`,
      'PUT',
      input,
      options,
    );
  },

  deleteQuiz(lessonId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(
      `/academy/course-version-lessons/${encodeId(lessonId)}/quiz`,
      'DELETE',
      undefined,
      options,
    );
  },
};
