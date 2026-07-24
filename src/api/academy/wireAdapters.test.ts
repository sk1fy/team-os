import { describe, expect, it } from 'vitest';
import {
  normalizeCampaignCreated,
  normalizeCampaignReport,
  normalizeExternalLanding,
  normalizeExternalOutline,
  normalizeExternalResults,
  normalizeLearnerTimeline,
  normalizePersonalAccessCreated,
  normalizeQuizAttempt,
  normalizeVerificationConfirmed,
  toWireQuizAnswers,
} from './wireAdapters';

describe('Academy wire adapters (OpenAPI shapes)', () => {
  it('maps PublicAcademyAccess landing fields to UI landing model', () => {
    expect(
      normalizeExternalLanding({
        kind: 'personal_access',
        courseId: 'c1',
        courseVersionId: 'v1',
        title: 'Внешний курс',
        description: 'Описание',
        coverUrl: 'https://example.com/cover.png',
        ownerType: 'partner',
        deadlineDays: 5,
        available: true,
        emailVerificationRequired: true,
        outline: [],
      }),
    ).toMatchObject({
      status: 'valid',
      purpose: 'personal',
      courseTitle: 'Внешний курс',
      courseDescription: 'Описание',
      courseCoverUrl: 'https://example.com/cover.png',
      deadlineDays: 5,
      requiresEmailVerification: true,
    });
  });

  it('maps unavailable public access to a landing status', () => {
    expect(
      normalizeExternalLanding({
        kind: 'partner_promo_campaign',
        title: 'Промо',
        available: false,
        unavailableReason: 'distribution_paused',
        emailVerificationRequired: true,
        deadlineDays: 3,
        courseId: 'c1',
        courseVersionId: 'v1',
        ownerType: 'partner',
        outline: [],
      }),
    ).toMatchObject({
      status: 'distribution_paused',
      purpose: 'partner_promo',
      courseTitle: 'Промо',
      message: 'distribution_paused',
    });
  });

  it('treats verification confirm as ready session when only learnerId is returned', () => {
    expect(
      normalizeVerificationConfirmed({
        learnerId: 'learner-1',
        verifiedAt: '2026-07-24T10:00:00Z',
      }),
    ).toMatchObject({
      learnerId: 'learner-1',
      accessStatus: 'ready',
    });
  });

  it('maps external outline envelope to learner outline sections', () => {
    const outline = normalizeExternalOutline({
      enrollment: {
        id: 'e1',
        courseId: 'c1',
        courseVersionId: 'v1',
        versionNumber: 2,
        progressStatus: 'in_progress',
        accessStatus: 'active',
        progressPercent: 10,
      },
      sections: [
        {
          id: 's1',
          title: 'Раздел',
          order: 0,
          lessons: [
            { id: 'l1', title: 'Урок 1', order: 0, status: 'completed' },
            { id: 'l2', title: 'Урок 2', order: 1, status: 'current' },
            {
              id: 'l3',
              title: 'Урок 3',
              order: 2,
              status: 'locked',
              lockReason: 'Сначала предыдущий',
            },
          ],
        },
      ],
    });

    expect(outline.sections[0]?.lessons).toEqual([
      expect.objectContaining({ id: 'l1', completed: true, locked: false }),
      expect.objectContaining({ id: 'l2', completed: false, locked: false }),
      expect.objectContaining({
        id: 'l3',
        completed: false,
        locked: true,
        lockReason: 'Сначала предыдущий',
      }),
    ]);
  });

  it('normalizes flat external quiz attempt and maps UI answers to wire fields', () => {
    expect(
      normalizeQuizAttempt(
        {
          id: 'attempt-1',
          score: 80,
          passed: true,
          pendingReview: false,
          attemptsRemaining: 1,
          createdAt: '2026-07-24T10:00:00Z',
        },
        { enrollmentId: 'e1', quizId: 'q1' },
      ),
    ).toMatchObject({
      attemptId: 'attempt-1',
      quizId: 'q1',
      enrollmentId: 'e1',
      score: 80,
      passed: true,
      pendingReview: false,
    });

    expect(
      toWireQuizAnswers([
        { questionId: 'qq1', selectedOptionIds: ['o1'] },
        { questionId: 'qq2', openText: 'ответ' },
      ]),
    ).toEqual([
      { questionId: 'qq1', optionIds: ['o1'] },
      { questionId: 'qq2', text: 'ответ' },
    ]);
  });

  it('builds results lesson list from completedLessonIds + outline', () => {
    const results = normalizeExternalResults(
      {
        enrollment: {
          id: 'e1',
          courseId: 'c1',
          courseVersionId: 'v1',
          progressStatus: 'in_progress',
          accessStatus: 'active',
          progressPercent: 50,
        },
        completedLessonIds: ['l1'],
        quizAttempts: [
          {
            id: 'a1',
            score: 100,
            passed: true,
            pendingReview: false,
            createdAt: '2026-07-24T10:00:00Z',
          },
        ],
      },
      {
        id: 'v1',
        courseId: 'c1',
        versionNumber: 1,
        title: 'Курс',
        sequential: true,
        sections: [
          {
            id: 's1',
            title: 'S',
            order: 0,
            lessons: [
              {
                id: 'l1',
                title: 'Первый',
                order: 0,
                locked: false,
                completed: true,
                hasQuiz: false,
              },
              {
                id: 'l2',
                title: 'Второй',
                order: 1,
                locked: false,
                completed: false,
                hasQuiz: true,
              },
            ],
          },
        ],
      },
    );

    expect(results.enrollment.percent).toBe(50);
    expect(results.enrollment.completedLessons).toBe(1);
    expect(results.enrollment.totalLessons).toBe(2);
    expect(results.lessonResults).toEqual([
      expect.objectContaining({ lessonId: 'l1', title: 'Первый', completed: true }),
      expect.objectContaining({ lessonId: 'l2', title: 'Второй', completed: false }),
    ]);
    expect(results.quizAttempts[0]).toMatchObject({ attemptId: 'a1', passed: true });
  });

  it('unpacks personal access and campaign create wrappers with one-time token', () => {
    const access = normalizePersonalAccessCreated({
      access: {
        id: 'pa1',
        courseId: 'c1',
        courseVersionId: 'v1',
        expectedEmail: 'a@example.com',
        recipientFirstName: 'Иван',
        deadlineDays: 3,
        status: 'issued',
        issuedAt: '2026-07-24T10:00:00Z',
      },
      token: 'secret-token-value-32-chars-min!!',
    });
    expect(access).toMatchObject({
      id: 'pa1',
      email: 'a@example.com',
      displayName: 'Иван',
      oneTimeToken: 'secret-token-value-32-chars-min!!',
    });
    expect(access.publicUrl).toContain('/training/secret-token-value-32-chars-min!!');

    const campaign = normalizeCampaignCreated({
      campaign: {
        id: 'camp1',
        courseId: 'c1',
        courseVersionId: 'v1',
        purpose: 'company_candidate',
        name: 'Кандидаты',
        status: 'active',
        createdAt: '2026-07-24T10:00:00Z',
        deadlineDays: 3,
      },
      token: 'campaign-secret-token-value-32!!',
    });
    expect(campaign.oneTimeToken).toBe('campaign-secret-token-value-32!!');
    expect(campaign.publicUrl).toContain('/training/campaign-secret-token-value-32!!');
  });

  it('maps the OpenAPI campaign report envelope to the UI report model', () => {
    const report = normalizeCampaignReport(
      {
        campaign: {
          id: 'campaign-1',
          courseId: 'course-1',
          courseVersionId: 'version-1',
          purpose: 'partner_promo',
          name: 'Летняя кампания',
          status: 'active',
          createdAt: '2026-07-24T10:00:00Z',
        },
        funnel: {
          views: 12,
          uniqueVisitors: 10,
          formSubmits: 8,
          verifiedEmails: 7,
          activations: 6,
          completions: 2,
        },
        enrollments: [
          {
            id: 'enrollment-1',
            externalLearnerId: 'learner-1',
            progressStatus: 'in_progress',
            accessStatus: 'active',
            progressPercent: 40,
            activatedAt: '2026-07-24T11:00:00Z',
          },
          {
            id: 'enrollment-2',
            externalLearnerId: 'learner-2',
            progressStatus: 'completed',
            accessStatus: 'expired',
            progressPercent: 100,
          },
        ],
        analytics: {
          firstLessonStarts: 6,
          lessonCompletions: 9,
          quizSubmissions: 4,
          expiredEnrollments: 1,
          returnVisits: 3,
          averageProgressPercent: 55,
          medianProgressPercent: 60,
          attribution: [
            {
              utmSource: 'telegram',
              utmCampaign: 'summer',
              visits: 5,
              activations: 3,
              completions: 1,
            },
          ],
        },
      },
      { page: 1, pageSize: 50 },
    );

    expect(report).toMatchObject({
      campaignId: 'campaign-1',
      campaignName: 'Летняя кампания',
      purpose: 'partner_promo',
      courseId: 'course-1',
      funnel: {
        landings: 12,
        verified: 7,
        activated: 6,
        inProgress: 1,
        completed: 2,
        expired: 1,
      },
      participants: {
        page: 1,
        total: 2,
        items: [
          expect.objectContaining({
            enrollmentId: 'enrollment-1',
            learnerId: 'learner-1',
            percent: 40,
          }),
          expect.objectContaining({
            enrollmentId: 'enrollment-2',
            learnerId: 'learner-2',
            percent: 100,
          }),
        ],
      },
      analytics: {
        firstLessonStarts: 6,
        lessonCompletions: 9,
        quizSubmissions: 4,
        expiredEnrollments: 1,
        returnVisits: 3,
        averageProgressPercent: 55,
        medianProgressPercent: 60,
      },
      utmBreakdown: [expect.objectContaining({ source: 'telegram', campaign: 'summer', count: 5 })],
    });
  });

  it('keeps the campaign purpose and source in a learner event timeline', () => {
    expect(
      normalizeLearnerTimeline({
        events: [
          {
            enrollmentId: 'enrollment-1',
            courseId: 'course-1',
            type: 'activated',
            sourceType: 'partner_promo_campaign',
            sourceId: 'campaign-1',
            occurredAt: '2026-07-24T10:00:00Z',
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        enrollmentId: 'enrollment-1',
        purpose: 'partner_promo',
        campaignId: 'campaign-1',
        activatedAt: '2026-07-24T10:00:00Z',
      }),
    ]);
  });
});
