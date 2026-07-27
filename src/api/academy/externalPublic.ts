/**
 * Public external Academy — authMode none/external, never internal Bearer.
 * Paths and schemas: contracts/openapi/teamos.yaml § public/academy.
 */

import type {
  ExternalAccessLanding,
  ExternalEnrollmentDetail,
  ExternalEnrollmentResults,
  ExternalQuizSubmitResponse,
  ExternalSessionState,
  ExternalVerificationChallenge,
} from '@/types/academyExternal';
import type { CourseVersionLearnerDetail, LessonLearner, QuizAttemptAnswer } from '@/types/academy';
import type { ID } from '@/types';
import type { components } from '@/api/generated/teamos';
import { createId } from '@/lib/id';
import { encodeId, externalGet, externalMutate, type RequestOptions } from './httpHelpers';
import {
  asString,
  isEnrollmentLike,
  normalizeExternalEnrollment,
  normalizeExternalLanding,
  normalizeExternalLesson,
  normalizeExternalOutline,
  normalizeExternalResults,
  normalizeQuizAttempt,
  normalizeVerificationChallenge,
  normalizeVerificationConfirmed,
  toWireQuizAnswers,
} from './wireAdapters';

type PublicOptions = RequestOptions & { authMode?: 'external' | 'none' };
type PublicAcademyAccessWire = components['schemas']['PublicAcademyAccess'];

export const academyExternalPublicApi = {
  async getLanding(token: string, options?: PublicOptions): Promise<ExternalAccessLanding> {
    const wire = await externalGet<PublicAcademyAccessWire>(
      `/public/academy/access/${encodeId(token)}`,
      {
        ...options,
        authMode: options?.authMode ?? 'none',
      },
    );
    return normalizeExternalLanding(wire);
  },

  async startVerification(
    token: string,
    input: {
      email: string;
      firstName?: string;
      lastName?: string;
    },
    options?: PublicOptions,
  ): Promise<ExternalVerificationChallenge> {
    // OpenAPI RequestExternalVerificationInput: email/firstName/lastName only.
    const body = {
      email: input.email,
      ...(input.firstName?.trim() ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName?.trim() ? { lastName: input.lastName.trim() } : {}),
    };
    const wire = await externalMutate<unknown>(
      `/public/academy/access/${encodeId(token)}/request-verification`,
      'POST',
      body,
      { ...options, authMode: options?.authMode ?? 'none' },
    );
    const challenge = normalizeVerificationChallenge(wire);
    return { ...challenge, email: challenge.email || input.email };
  },

  async confirmVerification(
    challengeId: ID,
    input: { code: string },
    options?: PublicOptions,
  ): Promise<ExternalSessionState & { readyEnrollmentId?: ID; learnerId?: ID }> {
    const wire = await externalMutate<unknown>(
      `/public/academy/verifications/${encodeId(challengeId)}/confirm`,
      'POST',
      input,
      { ...options, authMode: options?.authMode ?? 'none' },
    );
    return normalizeVerificationConfirmed(wire);
  },

  /**
   * Activation uses author-configured deadlineDays on the access/campaign.
   * Backend returns AcademyEnrollment / ExternalEnrollment; UI needs enrollmentId.
   */
  async activate(token: string, options?: PublicOptions): Promise<{ enrollmentId: ID }> {
    const wire = await externalMutate<unknown>(
      `/public/academy/access/${encodeId(token)}/activate`,
      'POST',
      {},
      {
        ...options,
        authMode: options?.authMode ?? 'external',
        idempotencyKey: options?.idempotencyKey ?? createId(),
      },
    );
    const record =
      typeof wire === 'object' && wire !== null ? (wire as Record<string, unknown>) : {};
    const enrollmentId = asString(
      record.enrollmentId ??
        (isEnrollmentLike(record) ? record.id : undefined) ??
        (isEnrollmentLike(record.enrollment) ? record.enrollment.id : undefined),
    );
    if (!enrollmentId) {
      throw new Error('Activation response did not include enrollment id');
    }
    return { enrollmentId };
  },

  async getEnrollment(
    enrollmentId: ID,
    options?: PublicOptions,
  ): Promise<ExternalEnrollmentDetail> {
    const wire = await externalGet<unknown>(
      `/public/academy/enrollments/${encodeId(enrollmentId)}`,
      {
        ...options,
        authMode: options?.authMode ?? 'external',
      },
    );
    return normalizeExternalEnrollment(wire);
  },

  async getOutline(enrollmentId: ID, options?: PublicOptions): Promise<CourseVersionLearnerDetail> {
    const wire = await externalGet<unknown>(
      `/public/academy/enrollments/${encodeId(enrollmentId)}/outline`,
      {
        ...options,
        authMode: options?.authMode ?? 'external',
      },
    );
    return normalizeExternalOutline(wire);
  },

  async getLesson(enrollmentId: ID, lessonId: ID, options?: PublicOptions): Promise<LessonLearner> {
    const wire = await externalGet<unknown>(
      `/public/academy/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}`,
      { ...options, authMode: options?.authMode ?? 'external' },
    );
    return normalizeExternalLesson(wire);
  },

  async completeLesson(
    enrollmentId: ID,
    lessonId: ID,
    options?: PublicOptions,
  ): Promise<ExternalEnrollmentDetail> {
    const wire = await externalMutate<unknown>(
      `/public/academy/enrollments/${encodeId(enrollmentId)}/lessons/${encodeId(lessonId)}/complete`,
      'POST',
      {},
      {
        ...options,
        authMode: options?.authMode ?? 'external',
        idempotencyKey: options?.idempotencyKey ?? createId(),
      },
    );
    return normalizeExternalEnrollment(wire);
  },

  /**
   * Backend returns ExternalQuizAttemptSubmitted: { attempt, enrollment }.
   * Also accepts legacy flat attempt and falls back to GET enrollment.
   */
  async submitQuiz(
    enrollmentId: ID,
    quizId: ID,
    input: { answers: QuizAttemptAnswer[] },
    options?: PublicOptions,
  ): Promise<ExternalQuizSubmitResponse> {
    const wire = await externalMutate<unknown>(
      `/public/academy/enrollments/${encodeId(enrollmentId)}/quizzes/${encodeId(quizId)}/attempts`,
      'POST',
      { answers: toWireQuizAnswers(input.answers) },
      {
        ...options,
        authMode: options?.authMode ?? 'external',
        idempotencyKey: options?.idempotencyKey ?? createId(),
      },
    );
    const record =
      typeof wire === 'object' && wire !== null ? (wire as Record<string, unknown>) : {};
    const attempt = normalizeQuizAttempt(record.attempt ?? record, { enrollmentId, quizId });
    if (isEnrollmentLike(record.enrollment)) {
      return {
        attempt,
        enrollment: normalizeExternalEnrollment(record.enrollment),
      };
    }
    const enrollment = await academyExternalPublicApi.getEnrollment(enrollmentId, options);
    return { attempt, enrollment };
  },

  async getResults(enrollmentId: ID, options?: PublicOptions): Promise<ExternalEnrollmentResults> {
    const [resultsWire, outline] = await Promise.all([
      externalGet<unknown>(`/public/academy/enrollments/${encodeId(enrollmentId)}/results`, {
        ...options,
        authMode: options?.authMode ?? 'external',
      }),
      academyExternalPublicApi.getOutline(enrollmentId, options).catch(() => null),
    ]);
    return normalizeExternalResults(resultsWire, outline);
  },
};
