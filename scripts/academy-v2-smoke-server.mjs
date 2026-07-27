import { createServer } from 'node:http';

const port = Number(process.env.ACADEMY_SMOKE_PORT ?? 8080);
const courseId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const now = '2026-07-27T09:00:00Z';

let partnerAudience = {
  audience: 'selected_partners',
  partnerUserIds: ['user-8'],
};

const course = {
  id: courseId,
  ownerType: 'company',
  title: 'Smoke: доступ партнёров',
  description: 'Локальная проверка Academy V2',
  lifecycleStatus: 'active',
  distributionStatus: 'active',
  sequential: true,
  visibility: 'company',
  deadlineDays: 3,
  latestPublishedVersion: {
    id: versionId,
    courseId,
    versionNumber: 1,
    status: 'published',
    title: 'Smoke: доступ партнёров',
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
  draftVersion: {
    id: versionId,
    courseId,
    versionNumber: 2,
    status: 'draft',
    title: 'Smoke: доступ партнёров',
    createdAt: now,
    updatedAt: now,
  },
  createdAt: now,
  updatedAt: now,
};

const draft = {
  id: versionId,
  courseId,
  versionNumber: 2,
  status: 'draft',
  title: course.title,
  description: course.description,
  sequential: true,
  sections: [],
  createdAt: now,
  updatedAt: now,
};

function send(response, status, body) {
  response.writeHead(status, {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, PATCH, POST, PUT, OPTIONS',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

async function readJSON(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    send(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  const coursePath = `/api/v1/academy/courses/${courseId}`;

  if (request.method === 'GET' && url.pathname === coursePath) {
    send(response, 200, course);
    return;
  }
  if (request.method === 'GET' && url.pathname === `${coursePath}/draft`) {
    send(response, 200, draft);
    return;
  }
  if (request.method === 'PATCH' && url.pathname === `${coursePath}/draft`) {
    Object.assign(course, await readJSON(request), { updatedAt: now });
    send(response, 200, course);
    return;
  }
  if (request.method === 'GET' && url.pathname === `${coursePath}/partner-audience`) {
    send(response, 200, partnerAudience);
    return;
  }
  if (request.method === 'PUT' && url.pathname === `${coursePath}/partner-audience`) {
    partnerAudience = await readJSON(request);
    send(response, 200, partnerAudience);
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/v1/public/academy/access/smoke-token') {
    send(response, 200, {
      status: 'valid',
      purpose: 'company_candidate',
      courseTitle: 'Smoke: внешнее обучение',
      courseDescription: 'Проверка формы идентификации',
      companyName: 'TeamOS Smoke',
      deadlineDays: 3,
      requiresEmailVerification: true,
    });
    return;
  }

  send(response, 404, {
    error: {
      message: `Smoke endpoint не реализован: ${request.method} ${url.pathname}`,
      status: 404,
    },
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Academy V2 smoke API: http://127.0.0.1:${port}/api/v1`);
  console.log(`Course builder: http://127.0.0.1:5173/academy/courses/${courseId}/builder`);
  console.log('External landing: http://127.0.0.1:5173/training/smoke-token');
});
