import { afterEach, describe, expect, it } from 'vitest';
import { orgApi } from '@/api';
import * as db from './fixtures';

const employee = db.users.find((user) => user.id === 'user-3')!;
const owner = db.users.find((user) => user.id === 'user-1')!;
const originalSections = employee.sectionAccess;
const originalShowInSchedule = employee.showInSchedule;
const originalOwnerShowInSchedule = owner.showInSchedule;

afterEach(() => {
  db.setCurrentUserId('user-1');
  employee.sectionAccess = originalSections;
  employee.showInSchedule = originalShowInSchedule;
  owner.showInSchedule = originalOwnerShowInSchedule;
});

describe('видимость сотрудника в графике', () => {
  it('сохраняет выключенный флаг для сотрудника', async () => {
    await expect(
      orgApi.updateUser({ id: employee.id, showInSchedule: false }),
    ).resolves.toMatchObject({ showInSchedule: false });
  });

  it('не позволяет включить владельца в график', async () => {
    await expect(orgApi.updateUser({ id: 'user-1', showInSchedule: true })).resolves.toMatchObject({
      showInSchedule: false,
    });
  });
});

describe('индивидуальный доступ сотрудника к разделам', () => {
  it('позволяет владельцу и администратору сохранить набор разделов', async () => {
    await expect(
      orgApi.updateUser({
        id: employee.id,
        sectionAccess: ['schedule', 'distribution'],
      }),
    ).resolves.toMatchObject({
      sectionAccess: ['schedule', 'distribution'],
    });

    db.setCurrentUserId('user-2');
    await expect(
      orgApi.updateUser({
        id: employee.id,
        sectionAccess: ['knowledge', 'academy'],
      }),
    ).resolves.toMatchObject({
      sectionAccess: ['knowledge', 'academy'],
    });
  });

  it('не позволяет сотруднику менять собственный набор разделов', async () => {
    db.setCurrentUserId(employee.id);

    await expect(
      orgApi.updateUser({ id: employee.id, sectionAccess: ['distribution'] }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('не применяет индивидуальную матрицу к партнёру', async () => {
    await expect(
      orgApi.updateUser({ id: 'user-8', sectionAccess: ['schedule'] }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('не позволяет оставить сотрудника без рабочего раздела', async () => {
    await expect(orgApi.updateUser({ id: employee.id, sectionAccess: [] })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('отклоняет повторяющиеся разделы', async () => {
    await expect(
      orgApi.updateUser({
        id: employee.id,
        sectionAccess: ['schedule', 'schedule'],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
