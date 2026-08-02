import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const unavailableStates = [
  ['distribution_paused', 'Распространение курса приостановлено.'],
  ['course_blocked', 'Курс заблокирован администрацией.'],
  ['course_archived', 'Курс находится в архиве.'],
  ['course_deleted', 'Курс удалён.'],
  ['access_revoked', 'Персональный доступ отозван.'],
  ['access_expired', 'Срок персонального доступа истёк.'],
  ['campaign_paused', 'Кампания временно приостановлена.'],
  ['campaign_revoked', 'Кампания отозвана.'],
  ['campaign_closed', 'Кампания закрыта.'],
  ['version_unavailable', 'Версия курса недоступна.'],
  ['unavailable', 'Доступ временно недоступен.'],
] as const;

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:8081/api/v1/__e2e/reset');
});

test('external learner verifies email, activates access, completes lessons and sees results', async ({
  page,
}) => {
  await page.goto('/training/e2e-token');

  await expect(page.getByRole('heading', { name: 'E2E: внешнее обучение' })).toBeVisible();
  await expect(page.getByText('Срок прохождения после активации:')).toContainText('3 дня');

  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByLabel('Имя').fill('Автотест');
  await page.getByLabel('Фамилия').fill('Playwright');
  await page.getByLabel('Email').fill('academy-e2e@example.test');
  await page.getByRole('button', { name: 'Получить код подтверждения' }).click();

  await expect(page.getByLabel('Код из письма')).toBeVisible();
  await page.getByLabel('Код из письма').fill('000000');
  await page.getByRole('button', { name: 'Подтвердить email' }).click();
  await expect(page.getByText('Код не подтверждён')).toBeVisible();

  await page.getByLabel('Код из письма').fill('123456');
  await page.getByRole('button', { name: 'Подтвердить email' }).click();
  await expect(page.getByText('Готово к старту')).toBeVisible();

  await page.getByRole('button', { name: 'Активировать и начать' }).click();
  await expect(page).toHaveURL(/\/training\/enrollments\/44444444-/);
  await expect(page.getByRole('heading', { name: 'Добро пожаловать' })).toBeVisible();
  await expect(page.getByText('Это настоящий browser E2E')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Перед началом' })).toBeVisible();
  await expect(page.getByText('Действовать по памяти')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Главная мысль' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Перед продолжением' })).toBeVisible();

  await page.getByRole('button', { name: 'Завершить урок' }).click();
  await expect(page.getByText('Урок завершён', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Далее: Следующий шаг')).toBeVisible();
  await page.getByRole('button', { name: 'Следующий урок' }).click();
  await expect(page.getByRole('heading', { name: 'Следующий шаг' })).toBeVisible();
  await expect(page.getByText('Второй урок открыт серверным состоянием.')).toBeVisible();

  await page.getByText('Пропустить практику и не обсуждать вопросы').click();
  await page.getByRole('button', { name: 'Проверить ответы' }).click();
  await expect(page.getByText('Тест не пройден', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Практика и фиксация результата помогают перенести знание в работу.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Попробовать ещё раз' }).click();
  await page.getByText('Применить алгоритм на практике и зафиксировать результат').click();
  await page.getByRole('button', { name: 'Проверить ответы' }).click();
  await expect(page.getByText('Тест пройден', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Завершить и продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Результаты прохождения' })).toBeVisible();
  await expect(page.getByText('2 / 2')).toBeVisible();
  await expect(page.getByText('Завершён')).toHaveCount(2);
});

for (const [reason, message] of unavailableStates) {
  test(`renders machine-readable unavailable state: ${reason}`, async ({ page }) => {
    await page.goto(`/training/${reason}`);

    await expect(page.getByText('E2E: внешнее обучение', { exact: true })).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Получить код подтверждения' })).toHaveCount(0);
  });
}

test('opens an already activated enrollment without starting a new verification', async ({
  page,
}) => {
  await page.goto('/training/already_activated');
  await expect(page.getByText('Этот доступ уже активирован. Продолжите')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить обучение' }).click();
  await expect(page.getByRole('heading', { name: 'Добро пожаловать' })).toBeVisible();
});

test('keeps lesson actions visible for a course with 15 sections and 75 lessons', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:8081/api/v1/__e2e/reset', {
    data: { largeCourse: true },
  });
  await page.goto('/training/enrollments/44444444-4444-4444-8444-444444444444');

  await expect(page.getByRole('heading', { name: 'Добро пожаловать' })).toBeVisible();
  const outline = page.getByRole('navigation', { name: 'Программа курса' });
  await expect(outline.locator(':scope > ul > li')).toHaveCount(15);

  const aside = page.locator('[data-player-outline]');
  await expect
    .poll(() => aside.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);

  const footer = page.locator('[data-player-footer]');
  const completeButton = page.getByRole('button', { name: 'Завершить урок' });
  await expect(footer).toBeVisible();
  await expect(completeButton).toBeVisible();
  const initialBox = await footer.boundingBox();

  await aside.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const scrolledBox = await footer.boundingBox();
  const viewport = page.viewportSize();

  expect(initialBox).not.toBeNull();
  expect(scrolledBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs((scrolledBox?.y ?? 0) - (initialBox?.y ?? 0))).toBeLessThan(1);
  expect((scrolledBox?.y ?? 0) + (scrolledBox?.height ?? 0)).toBeLessThanOrEqual(
    viewport?.height ?? 0,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  const contentScroll = page.locator('[data-player-content-scroll]');
  await contentScroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const mobileFooterBox = await footer.boundingBox();

  expect(mobileFooterBox).not.toBeNull();
  expect((mobileFooterBox?.y ?? 0) + (mobileFooterBox?.height ?? 0)).toBeLessThanOrEqual(844);
  await expect(completeButton).toBeVisible();
});
