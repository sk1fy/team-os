import { createServer } from 'node:http';

const port = Number(process.env.ACADEMY_FIXTURE_PORT ?? 8081);
const courseId = '11111111-1111-4111-8111-111111111111';
const publishedVersionId = '22222222-2222-4222-8222-222222222222';
const draftVersionId = '33333333-3333-4333-8333-333333333333';
const enrollmentId = '44444444-4444-4444-8444-444444444444';
const challengeId = '55555555-5555-4555-8555-555555555555';
const learnerId = '66666666-6666-4666-8666-666666666666';
const firstLessonId = '77777777-7777-4777-8777-777777777777';
const secondLessonId = '88888888-8888-4888-8888-888888888888';
const sectionId = '99999999-9999-4999-8999-999999999999';
const quizId = '12121212-1212-4121-8121-121212121212';
const quizQuestionId = '13131313-1313-4131-8131-131313131313';
const wrongOptionId = '14141414-1414-4141-8141-141414141414';
const correctOptionId = '15151515-1515-4151-8151-151515151515';
const now = '2026-07-27T09:00:00Z';
const accessUntil = '2099-07-30T09:00:00Z';

let completedLessonIds = [];
let quizAttemptsUsed = 0;

const unavailableStates = new Set([
  'distribution_paused',
  'course_blocked',
  'course_archived',
  'course_deleted',
  'access_revoked',
  'access_expired',
  'campaign_paused',
  'campaign_revoked',
  'campaign_closed',
  'version_unavailable',
  'unavailable',
]);

const unavailableMessages = {
  distribution_paused: 'Распространение курса приостановлено.',
  course_blocked: 'Курс заблокирован администрацией.',
  course_archived: 'Курс находится в архиве.',
  course_deleted: 'Курс удалён.',
  access_revoked: 'Персональный доступ отозван.',
  access_expired: 'Срок персонального доступа истёк.',
  campaign_paused: 'Кампания временно приостановлена.',
  campaign_revoked: 'Кампания отозвана.',
  campaign_closed: 'Кампания закрыта.',
  version_unavailable: 'Версия курса недоступна.',
  unavailable: 'Доступ временно недоступен.',
};

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, PATCH, POST, PUT, OPTIONS',
    'Access-Control-Allow-Origin': request.headers.origin ?? 'http://127.0.0.1:5173',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function send(request, response, status, body, headers = {}) {
  response.writeHead(status, { ...corsHeaders(request), ...headers });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

async function readJSON(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function enrollment() {
  const completed = completedLessonIds.length;
  return {
    id: enrollmentId,
    companyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    courseId,
    courseVersionId: publishedVersionId,
    versionNumber: 1,
    courseTitle: 'E2E: внешнее обучение',
    learnerType: 'external',
    externalLearnerId: learnerId,
    sourceType: 'personal_access',
    attemptNumber: 1,
    progressStatus: completed === 2 ? 'completed' : completed === 0 ? 'not_started' : 'in_progress',
    accessStatus: 'active',
    progressPercent: completed * 50,
    completedLessons: completed,
    totalLessons: 2,
    currentLessonVersionId: completed === 0 ? firstLessonId : secondLessonId,
    accessUntil,
    createdAt: now,
  };
}

function outline() {
  return {
    enrollment: enrollment(),
    sections: [
      {
        id: sectionId,
        title: 'Старт',
        order: 0,
        lessons: [
          {
            id: firstLessonId,
            title: 'Добро пожаловать',
            order: 0,
            status: completedLessonIds.includes(firstLessonId) ? 'completed' : 'current',
          },
          {
            id: secondLessonId,
            title: 'Следующий шаг',
            order: 1,
            status: completedLessonIds.includes(secondLessonId)
              ? 'completed'
              : completedLessonIds.includes(firstLessonId)
                ? 'current'
                : 'locked',
            lockReason: completedLessonIds.includes(firstLessonId)
              ? undefined
              : 'Сначала завершите предыдущий урок',
          },
        ],
      },
    ],
  };
}

function lesson(lessonId) {
  const isFirst = lessonId === firstLessonId;
  return {
    lesson: {
      id: lessonId,
      courseId,
      courseVersionId: publishedVersionId,
      sectionVersionId: sectionId,
      title: isFirst ? 'Добро пожаловать' : 'Следующий шаг',
      order: isFirst ? 0 : 1,
      status: completedLessonIds.includes(lessonId) ? 'completed' : 'current',
      content: {
        type: 'doc',
        content: isFirst
          ? [
              {
                type: 'lessonBlock',
                attrs: { id: 'fixture-intro', kind: 'richText' },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: 'Это настоящий browser E2E с навигацией, OTP и assertions.',
                      },
                    ],
                  },
                ],
              },
              {
                type: 'lessonBlock',
                attrs: {
                  id: 'fixture-warning',
                  kind: 'callout',
                  data: {
                    style: 'card',
                    tone: 'warning',
                    title: 'Перед началом',
                    body: 'Проверьте исходные данные и только потом переходите к действию.',
                  },
                },
              },
              {
                type: 'lessonBlock',
                attrs: {
                  id: 'fixture-comparison',
                  kind: 'comparison',
                  data: {
                    style: 'accent',
                    eyebrow: 'Частые ошибки',
                    rows: [
                      {
                        id: 'fixture-comparison-row',
                        avoid: 'Действовать по памяти',
                        prefer: 'Свериться с актуальным регламентом',
                      },
                    ],
                  },
                },
              },
              {
                type: 'lessonBlock',
                attrs: {
                  id: 'fixture-takeaway',
                  kind: 'takeaway',
                  data: {
                    style: 'outline',
                    title: 'Главная мысль',
                    body: 'Проверяйте факты до того, как переходить к следующему шагу.',
                  },
                },
              },
              {
                type: 'lessonBlock',
                attrs: {
                  id: 'fixture-checklist',
                  kind: 'checklist',
                  data: {
                    style: 'minimal',
                    title: 'Перед продолжением',
                    items: [
                      { id: 'fixture-check-1', text: 'Материал прочитан' },
                      { id: 'fixture-check-2', text: 'Главный риск понятен' },
                    ],
                  },
                },
              },
            ]
          : [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Второй урок открыт серверным состоянием.' }],
              },
            ],
      },
      quiz: isFirst
        ? undefined
        : {
            id: quizId,
            lessonId,
            passingScore: 100,
            maxAttempts: 3,
            attemptsUsed: quizAttemptsUsed,
            questions: [
              {
                id: quizQuestionId,
                type: 'single',
                text: 'Как лучше закрепить результат этого модуля?',
                options: [
                  { id: wrongOptionId, text: 'Пропустить практику и не обсуждать вопросы' },
                  {
                    id: correctOptionId,
                    text: 'Применить алгоритм на практике и зафиксировать результат',
                  },
                ],
              },
            ],
          },
    },
    enrollment: enrollment(),
  };
}

function activeLanding() {
  return {
    kind: 'personal_access',
    courseId,
    courseVersionId: publishedVersionId,
    title: 'E2E: внешнее обучение',
    description: 'Проверка полного публичного сценария в браузере.',
    ownerType: 'partner',
    ownerUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    deadlineDays: 3,
    available: true,
    emailVerificationRequired: true,
    outline: outline().sections,
  };
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    send(request, response, 204);
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  const tokenMatch = url.pathname.match(/^\/api\/v1\/public\/academy\/access\/([^/]+)$/);
  if (request.method === 'GET' && tokenMatch) {
    const token = decodeURIComponent(tokenMatch[1]);
    if (token === 'already_activated') {
      send(request, response, 200, {
        ...activeLanding(),
        available: false,
        unavailableReason: 'already_activated',
        existingEnrollmentId: enrollmentId,
        message: 'Этот доступ уже активирован.',
      });
      return;
    }
    if (unavailableStates.has(token)) {
      send(request, response, 200, {
        ...activeLanding(),
        available: false,
        unavailableReason: token,
        message: unavailableMessages[token],
      });
      return;
    }
    send(request, response, 200, activeLanding());
    return;
  }

  if (
    request.method === 'POST' &&
    url.pathname === '/api/v1/public/academy/access/e2e-token/request-verification'
  ) {
    const input = await readJSON(request);
    send(request, response, 201, {
      challengeId,
      email: input.email,
      expiresAt: '2099-07-27T09:10:00Z',
      resendAvailableAt: '2026-07-27T09:00:00Z',
    });
    return;
  }

  if (
    request.method === 'POST' &&
    url.pathname === `/api/v1/public/academy/verifications/${challengeId}/confirm`
  ) {
    const input = await readJSON(request);
    if (input.code !== '123456') {
      send(request, response, 400, {
        error: { status: 400, code: 'INVALID_VERIFICATION_CODE', message: 'Неверный код' },
      });
      return;
    }
    send(
      request,
      response,
      200,
      { learnerId, verifiedAt: now },
      { 'Set-Cookie': 'teamos_academy_external=e2e; Path=/; SameSite=Lax' },
    );
    return;
  }

  if (
    request.method === 'POST' &&
    url.pathname === '/api/v1/public/academy/access/e2e-token/activate'
  ) {
    send(request, response, 201, { enrollment: enrollment() });
    return;
  }

  if (
    request.method === 'GET' &&
    url.pathname === `/api/v1/public/academy/enrollments/${enrollmentId}`
  ) {
    send(request, response, 200, enrollment());
    return;
  }

  if (
    request.method === 'GET' &&
    url.pathname === `/api/v1/public/academy/enrollments/${enrollmentId}/outline`
  ) {
    send(request, response, 200, outline());
    return;
  }

  const completeMatch = url.pathname.match(
    new RegExp(`^/api/v1/public/academy/enrollments/${enrollmentId}/lessons/([^/]+)/complete$`),
  );
  if (request.method === 'POST' && completeMatch) {
    const lessonId = decodeURIComponent(completeMatch[1]);
    if (!completedLessonIds.includes(lessonId)) completedLessonIds.push(lessonId);
    send(request, response, 200, enrollment());
    return;
  }

  const lessonMatch = url.pathname.match(
    new RegExp(`^/api/v1/public/academy/enrollments/${enrollmentId}/lessons/([^/]+)$`),
  );
  if (request.method === 'GET' && lessonMatch) {
    send(request, response, 200, lesson(decodeURIComponent(lessonMatch[1])));
    return;
  }

  if (
    request.method === 'POST' &&
    url.pathname === `/api/v1/public/academy/enrollments/${enrollmentId}/quizzes/${quizId}/attempts`
  ) {
    const input = await readJSON(request);
    const selectedOptionIds = input.answers?.[0]?.optionIds ?? [];
    const passed = selectedOptionIds.includes(correctOptionId);
    quizAttemptsUsed += 1;
    if (passed && !completedLessonIds.includes(secondLessonId)) {
      completedLessonIds.push(secondLessonId);
    }
    send(request, response, 201, {
      attempt: {
        id: `fixture-attempt-${quizAttemptsUsed}`,
        quizVersionId: quizId,
        enrollmentId,
        attemptNumber: quizAttemptsUsed,
        maxAttempts: 3,
        score: passed ? 100 : 0,
        passed,
        pendingReview: false,
        feedback: [
          {
            questionId: quizQuestionId,
            correct: passed,
            selectedOptionIds,
            correctOptionIds: [correctOptionId],
            explanation: 'Практика и фиксация результата помогают перенести знание в работу.',
          },
        ],
        createdAt: now,
      },
      enrollment: enrollment(),
    });
    return;
  }

  if (
    request.method === 'GET' &&
    url.pathname === `/api/v1/public/academy/enrollments/${enrollmentId}/results`
  ) {
    send(request, response, 200, {
      enrollment: enrollment(),
      completedLessonIds,
      lessonResults: [
        {
          lessonId: firstLessonId,
          title: 'Добро пожаловать',
          completed: completedLessonIds.includes(firstLessonId),
        },
        {
          lessonId: secondLessonId,
          title: 'Следующий шаг',
          completed: completedLessonIds.includes(secondLessonId),
        },
      ],
      quizAttempts: [],
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/__e2e/reset') {
    completedLessonIds = [];
    quizAttemptsUsed = 0;
    send(request, response, 204);
    return;
  }

  send(request, response, 404, {
    error: {
      message: `Fixture endpoint не реализован: ${request.method} ${url.pathname}`,
      status: 404,
    },
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Academy V2 fixture API: http://127.0.0.1:${port}/api/v1`);
  console.log(`Published version: ${publishedVersionId}; draft version: ${draftVersionId}`);
});
