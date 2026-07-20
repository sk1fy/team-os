import { describe, expect, it } from 'vitest';
import {
  createActivityPanel,
  normalizeActivityEmployees,
  normalizeActivitySettings,
} from './activity';

describe('activity legacy normalizers', () => {
  it('нормализует mixed snake/camel поля и сохраняет неизвестные значения', () => {
    const result = normalizeActivitySettings({
      data: {
        revision: 7,
        panels: [
          {
            id: 15,
            panelName: 'Продажи',
            employees: [101, '102'],
            workTimeFrom: 9,
            work_time_to: '18:00',
            custom_legacy_flag: 'keep-me',
            operators: [
              {
                employee_id: 101,
                enabled: true,
                plan: '42',
                call_duration: 12,
                legacyOperatorValue: 'keep-too',
              },
            ],
          },
        ],
        tasks: {
          task_panel_enabled: true,
          enabled_employees: ['101'],
          excluded_employees: [999],
          customTaskSetting: true,
        },
      },
    });

    expect(result.revision).toBe(7);
    expect(result.panels[0]).toMatchObject({
      id: '15',
      panel_name: 'Продажи',
      employees: [101, '102'],
      work_time_from: '9:00',
      work_time_to: '18:00',
      custom_legacy_flag: 'keep-me',
    });
    expect(result.panels[0]?.operators[0]).toMatchObject({
      employeeId: 101,
      enabled: true,
      plan: 42,
      callDuration: 12,
      talkDuration: 30,
      overtime: 180,
      legacyOperatorValue: 'keep-too',
    });
    expect(result.tasks).toMatchObject({
      task_panel_enabled: true,
      enabled_employees: ['101'],
      excluded_employees: [999],
      customTaskSetting: true,
    });
  });

  it('не отбрасывает сотрудников без отдела', () => {
    expect(
      normalizeActivityEmployees({ data: [{ id: 5, name: 'Анна', avatar: '/avatar.png' }] }),
    ).toEqual([
      expect.objectContaining({
        id: 5,
        name: 'Анна',
        groupId: 'group_amo_crm',
        groupName: 'Без отдела',
      }),
    ]);
  });

  it('создаёт независимую панель с безопасными значениями по умолчанию', () => {
    const panel = createActivityPanel('https://example.test/dashboard');

    expect(panel.panel_name).toBe('Моя компания');
    expect(panel.work_time_from).toBe('09:00');
    expect(panel.activePanelLink).toBe(`https://example.test/dashboard?id=${panel.id}`);
    expect(panel.employees).toEqual([]);
  });
});
