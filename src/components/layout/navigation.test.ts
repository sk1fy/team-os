import { describe, expect, it } from 'vitest';
import {
  catalogSection,
  groupHomeHref,
  isConnectedWidget,
  mainSections,
  readTabKey,
  resolveActiveTab,
  resolveNavLocation,
  settingsSection,
  tabHref,
  widgetById,
  widgets,
} from './navigation';

describe('navigation', () => {
  it('подключены только Контроль задач, Контроль активности и Распределение', () => {
    expect(widgets.filter(isConnectedWidget).map((widget) => widget.id)).toEqual([
      'task-control',
      'activity-control',
      'distribution',
    ]);
    // Очередь задач — ярлык на панель задач Контроля активности, а не отдельный виджет.
    expect(widgetById('task-queue')).toMatchObject({
      shortcutOf: 'activity-control',
      path: '/activity-control?tab=task-panel',
    });
  });

  it('группа ведёт на подключённый виджет, иначе на описание первого', () => {
    expect(groupHomeHref('tasks')).toBe('/task-control');
    expect(groupHomeHref('analytics')).toBe('/activity-control');
    expect(groupHomeHref('deals')).toBe('/distribution');
    expect(groupHomeHref('automation')).toBe('/integrations/duplicates');
  });

  it('определяет раздел и виджет по адресу', () => {
    expect(resolveNavLocation('/employees')).toMatchObject({
      kind: 'section',
      section: { id: 'employees' },
    });
    expect(resolveNavLocation('/notifications')).toMatchObject({
      kind: 'section',
      section: { id: 'home' },
    });
    expect(resolveNavLocation('/distribution/abc')).toMatchObject({
      kind: 'widget',
      widget: { id: 'distribution' },
      group: { id: 'deals' },
    });
    expect(resolveNavLocation('/legacy/ssd-activity')).toMatchObject({
      kind: 'widget',
      widget: { id: 'activity-control' },
    });
    expect(resolveNavLocation('/integrations/whatsapp')).toMatchObject({
      kind: 'widget',
      widget: { id: 'whatsapp' },
      group: { id: 'communication' },
    });
    expect(resolveNavLocation('/integrations')).toMatchObject({
      kind: 'section',
      section: { id: catalogSection.id },
    });
    expect(resolveNavLocation('/unknown')).toEqual({ kind: 'none' });
  });

  it('активная вкладка: ?tab=, префиксы и вкладка по умолчанию', () => {
    const distribution = widgetById('distribution')!.tabs;
    expect(resolveActiveTab(distribution, '/distribution', '')?.key).toBe('queue');
    expect(resolveActiveTab(distribution, '/distribution', '?tab=journal')?.key).toBe('journal');
    expect(resolveActiveTab(distribution, '/distribution/g1', '')?.key).toBe('groups');
    expect(resolveActiveTab(distribution, '/distribution', '?tab=nope')?.key).toBe('queue');

    const home = mainSections.find((section) => section.id === 'home')!.tabs;
    expect(resolveActiveTab(home, '/notifications', '')?.key).toBe('notifications');

    // Неактивная вкладка не выбирается даже по прямой ссылке.
    const employees = mainSections.find((section) => section.id === 'employees')!.tabs;
    expect(employees?.find((tab) => tab.key === 'structure')?.disabled).toBe(true);
    expect(resolveActiveTab(employees, '/employees', '?tab=structure')?.key).toBe('list');
    expect(resolveActiveTab(employees, '/employees/42', '')?.key).toBe('list');
  });

  it('«Тариф и доступ» — только для управляющих ролей', () => {
    expect(settingsSection.tabs?.find((tab) => tab.key === 'plan')?.manageOnly).toBe(true);
  });

  it('читает и строит ключ вкладки', () => {
    const keys = ['rules', 'connection'] as const;
    expect(readTabKey('?tab=connection', keys, 'rules')).toBe('connection');
    expect(readTabKey('?tab=evil', keys, 'rules')).toBe('rules');
    expect(readTabKey('', keys, 'rules')).toBe('rules');
    expect(tabHref('/task-control', 'rules', 'rules')).toBe('/task-control');
    expect(tabHref('/task-control', 'connection', 'rules')).toBe('/task-control?tab=connection');
  });
});
