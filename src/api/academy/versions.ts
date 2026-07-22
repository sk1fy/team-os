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

/** Paths aligned with backend-plan §11.1–11.2 (course-versions content). */
export const academyVersionsApi = {
  list(courseId: ID, options?: RequestOptions): Promise<CourseVersionSummary[]> {
    return academyGet(`/academy/courses/${encodeId(courseId)}/versions`, options);
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
    return academyMutate(`/academy/courses/${encodeId(courseId)}/publish`, 'POST', {}, options);
  },

  createSection(
    versionId: ID,
    input: { title: string },
    options?: RequestOptions,
  ): Promise<SectionAuthor> {
    return academyMutate(
      `/academy/course-versions/${encodeId(versionId)}/sections`,
      'POST',
      input,
      options,
    );
  },

  updateSection(
    sectionId: ID,
    input: { title?: string; order?: number },
    options?: RequestOptions,
  ): Promise<SectionAuthor> {
    return academyMutate(
      `/academy/course-version-sections/${encodeId(sectionId)}`,
      'PATCH',
      input,
      options,
    );
  },

  deleteSection(sectionId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(
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
    },
    options?: RequestOptions,
  ): Promise<LessonAuthor> {
    return academyMutate(
      `/academy/course-versions/${encodeId(versionId)}/lessons`,
      'POST',
      input,
      options,
    );
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
    return academyMutate(
      `/academy/course-version-lessons/${encodeId(lessonId)}`,
      'PATCH',
      input,
      options,
    );
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
    return academyMutate(
      `/academy/course-version-lessons/${encodeId(lessonId)}/move`,
      'POST',
      input,
      options,
    );
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
