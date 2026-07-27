import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';

type Role = 'owner' | 'admin' | 'employee' | 'partner';
type Credentials = { email: string; password: string };
type CreatedUser = { id: string; email: string; role: Exclude<Role, 'owner'> };

const owner: Credentials = {
  email: process.env.E2E_OWNER_EMAIL ?? '',
  password: process.env.E2E_OWNER_PASSWORD ?? '',
};
const generatedPassword = 'Academy-E2E-2026!';
const applicationBaseURL = process.env.E2E_BASE_URL ?? '';
const apiBaseURL =
  process.env.E2E_API_URL ?? new URL('/api/v1', applicationBaseURL).toString().replace(/\/$/, '');
const apiPath = (path: string) => `${apiBaseURL}${path}`;

async function login(page: Page, credentials: Credentials) {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Пароль').fill(credentials.password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Some restricted roles cannot open the default landing route. Follow the
  // application's own recovery link so the global navigation becomes available.
  const forbiddenHeading = page.getByRole('heading', { name: 'Недостаточно прав' });
  if (await forbiddenHeading.isVisible()) {
    await page.getByRole('link', { name: 'Вернуться в доступный раздел' }).click();
    await expect(page).toHaveURL(/\/(?:schedule|academy)$/);
  }
}

async function openAcademy(page: Page) {
  await page.getByRole('link', { name: 'Академия', exact: true }).click();
  await expect(page).toHaveURL(/\/academy$/);
}

async function openOwnerCourses(page: Page) {
  await openAcademy(page);
  await page.getByRole('link', { name: 'Курсы компании', exact: true }).click();
  await expect(page).toHaveURL(/\/academy\/courses$/);
}

async function verifyRoleNavigation(browser: Browser, role: Role, credentials: Credentials) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(page, credentials);
    await openAcademy(page);
    await expect(page.getByRole('link', { name: 'Моё обучение', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Каталог', exact: true })).toBeVisible();

    if (role === 'employee') {
      await expect(page.getByRole('link', { name: 'Курсы компании' })).toHaveCount(0);
      await page.goto('/academy/courses');
      await expect(page.getByRole('heading', { name: 'Недостаточно прав' })).toBeVisible();
    } else if (role === 'partner') {
      await expect(page.getByRole('link', { name: 'Мои курсы' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Внешние ученики' })).toBeVisible();
      await page.goto('/academy/partners');
      await expect(page.getByRole('heading', { name: 'Недостаточно прав' })).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: 'Курсы компании' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Курсы партнёров' })).toBeVisible();
    }

    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(accessibility.violations).toEqual([]);
  } finally {
    await context.close();
  }
}

test('real backend exposes the Academy role matrix for owner, admin, employee and partner', async ({
  browser,
  request,
}) => {
  test.setTimeout(90_000);
  test.skip(!owner.email || !owner.password, 'E2E owner credentials are required');

  const loginResponse = await request.post(apiPath('/auth/login'), { data: owner });
  expect(loginResponse.ok()).toBeTruthy();
  const ownerSession = (await loginResponse.json()) as { accessToken: string };
  const authorization = { Authorization: `Bearer ${ownerSession.accessToken}` };
  const created: CreatedUser[] = [];

  try {
    for (const role of ['admin', 'employee', 'partner'] as const) {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const email = `academy-e2e-${role}-${suffix}@example.test`;
      const createResponse = await request.post(apiPath('/org/users'), {
        headers: authorization,
        data: {
          firstName: 'Academy',
          lastName: `E2E ${role}`,
          email,
          role,
        },
      });
      if (!createResponse.ok()) {
        throw new Error(`Не удалось создать ${role}: ${await createResponse.text()}`);
      }
      const user = (await createResponse.json()) as CreatedUser;
      created.push({ ...user, email, role });

      const passwordResponse = await request.put(
        apiPath(`/org/users/${encodeURIComponent(user.id)}/access/password`),
        {
          headers: authorization,
          data: { password: generatedPassword },
        },
      );
      if (!passwordResponse.ok()) {
        throw new Error(`Не удалось выдать пароль ${role}: ${await passwordResponse.text()}`);
      }
    }

    await verifyRoleNavigation(browser, 'owner', owner);
    for (const user of created) {
      await verifyRoleNavigation(browser, user.role, {
        email: user.email,
        password: generatedPassword,
      });
    }
  } finally {
    for (const user of created.reverse()) {
      await request.delete(apiPath(`/org/users/${encodeURIComponent(user.id)}`), {
        headers: authorization,
      });
    }
  }
});

test('owner creates, edits, publishes and removes a course through the real backend', async ({
  page,
  request,
}) => {
  test.skip(!owner.email || !owner.password, 'E2E owner credentials are required');

  const loginResponse = await request.post(apiPath('/auth/login'), { data: owner });
  expect(loginResponse.ok()).toBeTruthy();
  const ownerSession = (await loginResponse.json()) as { accessToken: string };
  const authorization = { Authorization: `Bearer ${ownerSession.accessToken}` };
  const title = `QA Academy E2E ${Date.now()}`;
  let courseId: string | undefined;

  try {
    await login(page, owner);
    await openOwnerCourses(page);
    await page.getByRole('button', { name: 'Создать курс', exact: true }).click();
    await page.getByLabel('Название').fill(title);
    await page.getByRole('button', { name: 'Создать и открыть конструктор' }).click();

    await expect(page).toHaveURL(/\/academy\/courses\/[^/]+\/builder$/);
    courseId = page.url().match(/\/academy\/courses\/([^/]+)\/builder$/)?.[1];
    expect(courseId).toBeTruthy();
    await expect(page.getByRole('heading', { name: new RegExp(title) })).toBeVisible();

    const sectionTitles = page.getByLabel('Название раздела');
    if ((await sectionTitles.count()) === 0) {
      await page.getByRole('button', { name: 'Добавить раздел' }).click();
    }
    await expect(sectionTitles.first()).toBeVisible();
    await page.getByRole('button', { name: 'Добавить урок' }).click();
    await expect(page.getByLabel('Название урока')).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Редактор форматированного текста' })
      .fill('Контент курса создан браузерным E2E против реального backend.');
    await page.getByRole('button', { name: 'Изображение' }).click();
    const imageDialog = page.getByRole('dialog', { name: 'Добавить изображение' });
    await imageDialog.getByLabel('Файл изображения').setInputFiles({
      name: 'academy-e2e.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(imageDialog.getByText('Изображение загружено')).toBeVisible();
    await imageDialog.getByRole('button', { name: 'Добавить', exact: true }).click();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Урок сохранён')).toBeVisible();

    await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
    const publishDialog = page.getByRole('dialog', { name: 'Опубликовать версию?' });
    const publishButton = publishDialog.getByRole('button', {
      name: 'Опубликовать',
      exact: true,
    });
    await expect(publishButton).toBeEnabled();
    await publishButton.click();
    await expect(page.getByText('Опубликована версия v1')).toBeVisible();

    await page.getByRole('link', { name: 'К курсу' }).click();
    const versionSummary = page.locator('dl');
    await expect(versionSummary).toContainText('Черновик');
    await expect(versionSummary).toContainText('Нет');
    await expect(versionSummary).toContainText('Опубликовано');
    await expect(versionSummary).toContainText('v1');
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();
    const deleteDialog = page.getByRole('dialog', { name: 'Удалить курс?' });
    await deleteDialog.getByRole('button', { name: 'Удалить', exact: true }).click();
    await expect(page).toHaveURL(/\/academy\/courses$/);
    courseId = undefined;
  } finally {
    if (courseId) {
      await request.delete(apiPath(`/academy/courses/${encodeURIComponent(courseId)}`), {
        headers: authorization,
      });
    }
  }
});

test('owner imports a linked knowledge-base article with its origin metadata', async ({
  page,
  request,
}) => {
  test.skip(!owner.email || !owner.password, 'E2E owner credentials are required');

  let authorization: { Authorization: string } | undefined;
  let courseId: string | undefined;

  try {
    await login(page, owner);
    await openOwnerCourses(page);
    await page.getByRole('button', { name: 'Создать курс', exact: true }).click();
    await page.getByRole('button', { name: 'Из базы знаний' }).click();
    await page.getByLabel('Название').fill(`QA KB import ${Date.now()}`);
    const articleCheckbox = page.getByRole('checkbox').first();
    await expect(articleCheckbox).toBeVisible();
    await articleCheckbox.check();
    await page.getByRole('button', { name: 'Импортировать и открыть' }).click();

    await expect(page).toHaveURL(/\/academy\/courses\/[^/]+\/builder$/);
    courseId = page.url().match(/\/academy\/courses\/([^/]+)\/builder$/)?.[1];
    expect(courseId).toBeTruthy();
    await expect(
      page.getByRole('textbox', { name: 'Редактор форматированного текста' }),
    ).toBeVisible();

    const loginResponse = await request.post(apiPath('/auth/login'), { data: owner });
    expect(loginResponse.ok()).toBeTruthy();
    const ownerSession = (await loginResponse.json()) as { accessToken: string };
    authorization = { Authorization: `Bearer ${ownerSession.accessToken}` };
    const draftResponse = await request.get(
      apiPath(`/academy/courses/${encodeURIComponent(courseId!)}/draft`),
      { headers: authorization },
    );
    expect(draftResponse.ok()).toBeTruthy();
    const draft = (await draftResponse.json()) as {
      sections?: Array<{
        lessons?: Array<{ sourceArticleId?: string; sourceType?: string; sourceMode?: string }>;
      }>;
    };
    const importedLesson = draft.sections
      ?.flatMap((section) => section.lessons ?? [])
      .find((lesson) => Boolean(lesson.sourceArticleId));
    expect(importedLesson).toMatchObject({ sourceArticleId: expect.any(String) });
    expect(importedLesson?.sourceType ?? importedLesson?.sourceMode).toMatch(/kb_link|link/);
  } finally {
    if (courseId) {
      if (!authorization) {
        const cleanupLogin = await request.post(apiPath('/auth/login'), { data: owner });
        if (cleanupLogin.ok()) {
          const session = (await cleanupLogin.json()) as { accessToken: string };
          authorization = { Authorization: `Bearer ${session.accessToken}` };
        }
      }
    }
    if (courseId && authorization) {
      await request.delete(apiPath(`/academy/courses/${encodeURIComponent(courseId)}`), {
        headers: authorization,
      });
    }
  }
});
