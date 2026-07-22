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

export const academyVersionsApi = {
  list(courseId: ID, options?: RequestOptions): Promise<CourseVersionSummary[]> {
    return academyGet(`/academy/v2/courses/${encodeId(courseId)}/versions`, options);
  },

  getAuthor(
    courseId: ID,
    versionId: ID,
    options?: RequestOptions,
  ): Promise<CourseVersionAuthorDetail> {
    return academyGet(
      `/academy/v2/courses/${encodeId(courseId)}/versions/${encodeId(versionId)}`,
      options,
    );
  },

  getLearner(versionId: ID, options?: RequestOptions): Promise<CourseVersionLearnerDetail> {
    return academyGet(`/academy/v2/course-versions/${encodeId(versionId)}/learner`, options);
  },

  publish(
    courseId: ID,
    options?: RequestOptions,
  ): Promise<{ courseId: ID; version: CourseVersionSummary }> {
    return academyMutate(
      `/academy/v2/courses/${encodeId(courseId)}/publish`,
      'POST',
      {},
      options,
    );
  },

  createSection(
    courseId: ID,
    input: { title: string },
    options?: RequestOptions,
  ): Promise<SectionAuthor> {
    return academyMutate(
      `/academy/v2/courses/${encodeId(courseId)}/draft/sections`,
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
      `/academy/v2/draft/sections/${encodeId(sectionId)}`,
      'PATCH',
      input,
      options,
    );
  },

  deleteSection(sectionId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(
      `/academy/v2/draft/sections/${encodeId(sectionId)}`,
      'DELETE',
      undefined,
      options,
    );
  },

  createLesson(
    courseId: ID,
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
      `/academy/v2/courses/${encodeId(courseId)}/draft/lessons`,
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
      `/academy/v2/draft/lessons/${encodeId(lessonId)}`,
      'PATCH',
      input,
      options,
    );
  },

  deleteLesson(lessonId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(
      `/academy/v2/draft/lessons/${encodeId(lessonId)}`,
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
      `/academy/v2/draft/lessons/${encodeId(lessonId)}/move`,
      'POST',
      input,
      options,
    );
  },

  upsertQuiz(input: Omit<QuizAuthor, 'id'> & { id?: ID }, options?: RequestOptions): Promise<QuizAuthor> {
    return academyMutate('/academy/v2/draft/quizzes', 'PUT', input, options);
  },
};
