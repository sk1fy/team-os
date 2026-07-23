/**
 * Public external Academy — authMode none/external, never internal Bearer.
 * Paths: backend-plan §11.8
 */

import type {
  ExternalAccessLanding,
  ExternalEnrollmentDetail,
  ExternalEnrollmentResults,
  ExternalQuizSubmitResponse,
  ExternalSessionState,
  ExternalVerificationChallenge,
} from '@/types/academyExternal';
import type {
  CourseVersionLearnerDetail,
  LessonLearner,
  QuizAttemptAnswer,
} from '@/types/academy';
import type { ID } from '@/types';
import { encodeId, externalGet, externalMutate, type RequestOptions } from './httpHelpers';

type PublicOptions = RequestOptions & { authMode?: 'external' | 'none' };

export const academyExternalPublicApi = {
  getLanding(token: string, options?: PublicOptions): Promise<ExternalAccessLanding> {
    return externalGet(`/public/academy/access/${encodeId(token)}`, {
      ...options,
      authMode: options?.authMode ?? 'none',
    });
  },

  startVerification(
    token: string,
    input: {
      email: string;
      firstName: string;
      lastName?: string;
      phone?: string;
    },
    options?: PublicOptions,
  ): Promise<ExternalVerificationChallenge> {
    return externalMutate(
      `/public/academy/access/${encodeId(token)}/request-verification`,
      'POST',
      input,
      { ...options, authMode: options?.authMode ?? 'none' },
    );
  },

  confirmVerification(
    challengeId: ID,
    input: { code: string },
    options?: PublicOptions,
  ): Promise<ExternalSessionState & { readyEnrollmentId?: ID }> {
    return externalMutate(
      `/public/academy/verifications/${encodeId(challengeId)}/confirm`,
      'POST',
      input,
      { ...options, authMode: options?.authMode ?? 'none' },
    );
  },

  /**
   * Activation uses author-configured deadlineDays on the access/campaign.
   * Body must not let the learner pick a different duration.
   */
  activate(token: string, options?: PublicOptions): Promise<{ enrollmentId: ID }> {
    return externalMutate(
      `/public/academy/access/${encodeId(token)}/activate`,
      'POST',
      {},
      { ...options, authMode: options?.authMode ?? 'external' },
    );
  },

  getEnrollment(enrollmentId: ID, options?: PublicOptions): Promise<ExternalEnrollmentDetail> {
    return externalGet(`/public/academy/enrollments/${encodeId(enrollmentId)}`, {
      ...options,
      authMode: options?.authMode ?? 'external',
    });
  },

  getOutline(enrollmentId: ID, options?: PublicOptions): Promise<CourseVersionLearnerDetail> {
    return externalGet(`/public/academy/enrollments/${encodeId(enrollmentId)}/outline`, {
      ...options,
      authMode: options?.authMode ?? 'external',
    });
  },

  getLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: PublicOptions,
  ): Promise<LessonLearner> {
    return externalGet(
      `/public/academy/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}`,
      { ...options, authMode: options?.authMode ?? 'external' },
    );
  },

  completeLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: PublicOptions,
  ): Promise<ExternalEnrollmentDetail> {
    return externalMutate(
      `/public/academy/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}/complete`,
      'POST',
      {},
      { ...options, authMode: options?.authMode ?? 'external' },
    );
  },

  submitQuiz(
    enrollmentId: ID,
    quizId: ID,
    input: { answers: QuizAttemptAnswer[] },
    options?: PublicOptions,
  ): Promise<ExternalQuizSubmitResponse> {
    return externalMutate(
      `/public/academy/enrollments/${encodeId(enrollmentId)}/quizzes/${encodeId(quizId)}/attempts`,
      'POST',
      input,
      { ...options, authMode: options?.authMode ?? 'external' },
    );
  },

  getResults(enrollmentId: ID, options?: PublicOptions): Promise<ExternalEnrollmentResults> {
    return externalGet(`/public/academy/enrollments/${encodeId(enrollmentId)}/results`, {
      ...options,
      authMode: options?.authMode ?? 'external',
    });
  },
};
