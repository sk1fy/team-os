/**
 * Public external Academy transport.
 * Does not use internal auth store; tokens are request-scoped secrets.
 */

import type {
  ExternalAccessLanding,
  ExternalSessionState,
  ExternalVerificationChallenge,
} from '@/types/academyExternal';
import type { EnrollmentDetail, LessonLearner, QuizAttemptAnswer, QuizAttemptResult } from '@/types/academy';
import type { ID } from '@/types';
import { encodeId, externalGet, externalMutate, type RequestOptions } from './httpHelpers';

export const academyExternalPublicApi = {
  getLanding(token: string, options?: RequestOptions): Promise<ExternalAccessLanding> {
    return externalGet(`/public/training/${encodeId(token)}`, options);
  },

  startVerification(
    token: string,
    input: { email: string; displayName?: string },
    options?: RequestOptions,
  ): Promise<ExternalVerificationChallenge> {
    return externalMutate(
      `/public/training/${encodeId(token)}/verify/start`,
      'POST',
      input,
      options,
    );
  },

  confirmVerification(
    token: string,
    input: { challengeId: ID; code: string },
    options?: RequestOptions,
  ): Promise<ExternalSessionState & { readyEnrollmentId?: ID }> {
    return externalMutate(
      `/public/training/${encodeId(token)}/verify/confirm`,
      'POST',
      input,
      options,
    );
  },

  activate(
    token: string,
    input: { deadlineDays: number },
    options?: RequestOptions,
  ): Promise<{ enrollmentId: ID }> {
    return externalMutate(
      `/public/training/${encodeId(token)}/activate`,
      'POST',
      input,
      options,
    );
  },

  getEnrollment(
    enrollmentId: ID,
    options?: RequestOptions,
  ): Promise<EnrollmentDetail> {
    return externalGet(`/public/training/enrollments/${encodeId(enrollmentId)}`, options);
  },

  getLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: RequestOptions,
  ): Promise<LessonLearner> {
    return externalGet(
      `/public/training/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}`,
      options,
    );
  },

  completeLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: RequestOptions,
  ): Promise<EnrollmentDetail> {
    return externalMutate(
      `/public/training/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}/complete`,
      'POST',
      {},
      options,
    );
  },

  submitQuiz(
    enrollmentId: ID,
    quizId: ID,
    input: { answers: QuizAttemptAnswer[] },
    options?: RequestOptions,
  ): Promise<QuizAttemptResult> {
    return externalMutate(
      `/public/training/enrollments/${encodeId(enrollmentId)}/quizzes/${encodeId(quizId)}/attempts`,
      'POST',
      input,
      options,
    );
  },
};
