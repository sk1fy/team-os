import { describe, expect, it } from 'vitest';
import {
  canAccessModule,
  canAccessRoute,
  canManageAccess,
  canManageContent,
  canManageIntegrations,
  employeeHomePath,
  moduleForPath,
  modulesForRole,
  safeHomePath,
} from './permissions';
import {
  academyNavForRole,
  canAccessAcademyPath,
  legacyAcademyRedirects,
} from './academy/routes';
import { resolveCourseCapabilities } from './academy/capabilities';

describe('permissions', () => {
  it('ограничивает сотрудника рабочими разделами и служебными страницами', () => {
    expect(employeeHomePath).toBe('/schedule');
    for (const path of [
      '/schedule',
      '/knowledge',
      '/academy',
      '/academy-opus',
      '/academy-grok',
      '/academy-grok/catalog',
      '/notifications',
      '/settings',
      '/learn/course-1',
      '/learn-opus/course-1',
      '/learn-grok/course-1',
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

  it('возвращает доступный home для каждой роли', () => {
    expect(safeHomePath('employee')).toBe('/schedule');
    expect(safeHomePath('partner')).toBe('/academy');
    expect(safeHomePath('owner')).toBe('/');
    expect(safeHomePath(undefined)).toBe('/auth/login');
  });
});

describe('module matrix', () => {
  it('partner имеет только knowledge/academy/notifications/profile/settings', () => {
    const modules = modulesForRole('partner');
    expect(modules).toEqual([
      'knowledge',
      'academy',
      'notifications',
      'profile',
      'settings',
    ]);
    expect(canAccessModule('partner', 'employees')).toBe(false);
    expect(canAccessModule('partner', 'tasks')).toBe(false);
    expect(canAccessModule('partner', 'distribution')).toBe(false);
    expect(canAccessModule('partner', 'integrations')).toBe(false);
    expect(canAccessModule('partner', 'academy')).toBe(true);
    expect(canAccessModule('partner', 'knowledge')).toBe(true);
  });

  it('employee не видит employees/tasks/distribution/dashboard', () => {
    expect(canAccessModule('employee', 'employees')).toBe(false);
    expect(canAccessModule('employee', 'tasks')).toBe(false);
    expect(canAccessModule('employee', 'dashboard')).toBe(false);
    expect(canAccessModule('employee', 'schedule')).toBe(true);
  });

  it('owner/admin имеют полный доступ к модулям', () => {
    expect(modulesForRole('owner')).toBe('*');
    expect(canAccessModule('admin', 'integrations')).toBe(true);
  });

  it('moduleForPath распознаёт academy и integrations', () => {
    expect(moduleForPath('/academy/catalog')).toBe('academy');
    expect(moduleForPath('/learn/enr-1')).toBe('academy');
    expect(moduleForPath('/activity-control')).toBe('integrations');
    expect(moduleForPath('/employees/u-1')).toBe('employees');
  });

  it('partner не проходит canAccessRoute на сотрудников и задачи', () => {
    expect(canAccessRoute('partner', '/employees')).toBe(false);
    expect(canAccessRoute('partner', '/tasks')).toBe(false);
    expect(canAccessRoute('partner', '/structure')).toBe(false);
    expect(canAccessRoute('partner', '/distribution')).toBe(false);
    expect(canAccessRoute('partner', '/activity-control')).toBe(false);
    expect(canAccessRoute('partner', '/knowledge')).toBe(true);
    expect(canAccessRoute('partner', '/academy')).toBe(true);
    expect(canAccessRoute('partner', '/notifications')).toBe(true);
    expect(canAccessRoute('partner', '/settings')).toBe(true);
  });
});

describe('academy route policy', () => {
  it('employee: home + catalog + learn', () => {
    expect(canAccessAcademyPath('employee', '/academy')).toBe(true);
    expect(canAccessAcademyPath('employee', '/academy/catalog')).toBe(true);
    expect(canAccessAcademyPath('employee', '/learn/enr-1')).toBe(true);
    expect(canAccessAcademyPath('employee', '/academy/courses')).toBe(false);
    expect(canAccessAcademyPath('employee', '/academy/partners')).toBe(false);
    expect(canAccessAcademyPath('employee', '/academy/reports')).toBe(false);
    expect(canAccessAcademyPath('employee', '/academy/learners')).toBe(false);
  });

  it('partner: courses/templates/reports/learners, no partners admin', () => {
    expect(canAccessAcademyPath('partner', '/academy/courses')).toBe(true);
    expect(canAccessAcademyPath('partner', '/academy/templates')).toBe(true);
    expect(canAccessAcademyPath('partner', '/academy/templates/t-1/builder')).toBe(false);
    expect(canAccessAcademyPath('partner', '/academy/reports')).toBe(true);
    expect(canAccessAcademyPath('partner', '/academy/learners')).toBe(true);
    expect(canAccessAcademyPath('partner', '/academy/partners')).toBe(false);
  });

  it('owner/admin: full academy tree', () => {
    expect(canAccessAcademyPath('owner', '/academy/partners')).toBe(true);
    expect(canAccessAcademyPath('admin', '/academy/learners/l-1')).toBe(true);
    expect(canAccessAcademyPath('admin', '/academy/courses/c-1/builder')).toBe(true);
  });

  it('nav labels differ for partner vs owner', () => {
    const partnerNav = academyNavForRole('partner').map((i) => i.label);
    const ownerNav = academyNavForRole('owner').map((i) => i.label);
    expect(partnerNav).toContain('Мои курсы');
    expect(partnerNav).not.toContain('Курсы партнёров');
    expect(ownerNav).toContain('Курсы компании');
    expect(ownerNav).toContain('Курсы партнёров');
    expect(academyNavForRole('employee').map((i) => i.id)).toEqual(['home', 'catalog']);
  });

  it('сохраняет legacy course workspace redirect', () => {
    expect(legacyAcademyRedirects).toContainEqual({
      from: '/academy/:courseId',
      to: '/academy/courses/:courseId',
    });
  });
});

describe('course capabilities', () => {
  const baseCourse = {
    ownerType: 'company' as const,
    lifecycleStatus: 'active' as const,
    distributionStatus: 'active' as const,
    draftVersion: { id: 'd1' } as never,
    latestPublishedVersion: { id: 'v1' } as never,
  };

  it('employee не получает management capabilities', () => {
    const caps = resolveCourseCapabilities({
      role: 'employee',
      userId: 'u1',
      course: baseCourse,
    });
    expect(caps.canEditDraft).toBe(false);
    expect(caps.canPublish).toBe(false);
    expect(caps.canAssignInternally).toBe(false);
  });

  it('owner может редактировать company course', () => {
    const caps = resolveCourseCapabilities({
      role: 'owner',
      userId: 'u1',
      course: baseCourse,
    });
    expect(caps.canEditDraft).toBe(true);
    expect(caps.canPublish).toBe(true);
    expect(caps.canAssignInternally).toBe(true);
    expect(caps.canCopyToCompany).toBe(false);
  });

  it('owner не редактирует partner original, но может copy/pause/block', () => {
    const caps = resolveCourseCapabilities({
      role: 'owner',
      userId: 'admin-1',
      course: {
        ownerType: 'partner',
        ownerUserId: 'partner-1',
        lifecycleStatus: 'active',
        distributionStatus: 'active',
        latestPublishedVersion: { id: 'v1' } as never,
      },
    });
    expect(caps.canEditDraft).toBe(false);
    expect(caps.canDelete).toBe(false);
    expect(caps.canPublish).toBe(false);
    expect(caps.canCopyToCompany).toBe(true);
    expect(caps.canPauseDistribution).toBe(true);
    expect(caps.canBlock).toBe(true);
  });

  it('partner редактирует только own course', () => {
    const own = resolveCourseCapabilities({
      role: 'partner',
      userId: 'p1',
      course: {
        ownerType: 'partner',
        ownerUserId: 'p1',
        lifecycleStatus: 'active',
        distributionStatus: 'active',
        draftVersion: { id: 'd1' } as never,
        latestPublishedVersion: { id: 'v1' } as never,
      },
    });
    expect(own.canEditDraft).toBe(true);
    expect(own.canPublish).toBe(true);
    expect(own.canCreatePersonalAccess).toBe(true);
    expect(own.canAssignInternally).toBe(false);

    const foreign = resolveCourseCapabilities({
      role: 'partner',
      userId: 'p1',
      course: {
        ownerType: 'partner',
        ownerUserId: 'p2',
        lifecycleStatus: 'active',
        distributionStatus: 'active',
      },
    });
    expect(foreign.canEditDraft).toBe(false);
    expect(foreign.canPublish).toBe(false);
  });

  it('backend capabilities override local inference', () => {
    const caps = resolveCourseCapabilities({
      role: 'owner',
      userId: 'u1',
      course: {
        ...baseCourse,
        capabilities: { canEditDraft: false, canPublish: false },
      },
    });
    expect(caps.canEditDraft).toBe(false);
    expect(caps.canPublish).toBe(false);
    // Unspecified keys still use local inference
    expect(caps.canAssignInternally).toBe(true);
  });
});
