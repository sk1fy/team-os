import { describe, expect, it } from 'vitest';
import {
  canAccessRoute,
  canManageAccess,
  canManageContent,
  canManageIntegrations,
  employeeHomePath,
} from './permissions';

describe('permissions', () => {
  it('ограничивает сотрудника тремя рабочими разделами и служебными страницами', () => {
    expect(employeeHomePath).toBe('/schedule');
    for (const path of [
      '/schedule',
      '/knowledge',
      '/academy',
      '/notifications',
      '/settings',
      '/learn/course-1',
      '/share/article/a-1',
    ]) {
      expect(canAccessRoute('employee', path)).toBe(true);
    }
    for (const path of ['/', '/employees', '/tasks', '/distribution']) {
      expect(canAccessRoute('employee', path)).toBe(false);
    }
  });

  it('разрешает управление контентом только owner/admin, доступом — только owner', () => {
    expect(canManageContent('owner')).toBe(true);
    expect(canManageContent('admin')).toBe(true);
    expect(canManageContent('employee')).toBe(false);
    expect(canManageAccess('owner')).toBe(true);
    expect(canManageAccess('admin')).toBe(false);
  });

  it('разрешает управление интеграциями только owner/admin', () => {
    expect(canManageIntegrations('owner')).toBe(true);
    expect(canManageIntegrations('admin')).toBe(true);
    expect(canManageIntegrations('employee')).toBe(false);
    expect(canManageIntegrations('partner')).toBe(false);
    expect(canManageIntegrations(undefined)).toBe(false);
  });
});
