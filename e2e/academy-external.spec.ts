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

  await page.getByRole('button', { name: 'Завершить и продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Следующий шаг' })).toBeVisible();
  await expect(page.getByText('Второй урок открыт серверным состоянием.')).toBeVisible();

  await page.getByRole('button', { name: 'Завершить и продолжить' }).click();
  await expect(page.getByText('100%')).toBeVisible();
  await page.getByRole('button', { name: 'Результаты' }).click();
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
