import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { useWidgetStatuses } from '@/components/integrations/widgetStatus';
import { canAccessRoute, canManageAccess, canManageIntegrations } from '@/lib/permissions';
import { mainSections, widgetGroups, widgets, type WidgetDef } from './navigation';

const pathOnly = (to: string) => to.split('?')[0];

/**
 * Что показывать в навигации текущему пользователю: разделы по правам,
 * группы интеграций и статусы виджетов (только тем, кто управляет интеграциями).
 */
export function useNavModel() {
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });
  const role = currentUser?.role;
  const sectionAccess = currentUser?.sectionAccess;
  const manageIntegrations = canManageIntegrations(role);
  const statuses = useWidgetStatuses(manageIntegrations);

  const sections = mainSections.filter((section) =>
    canAccessRoute(role, section.path, sectionAccess),
  );

  // Управляющим — все виджеты (неподключённые ведут на описание); остальным —
  // только подключённые разделы, к которым есть доступ (например, Распределение).
  const isVisibleWidget = (widget: WidgetDef) =>
    manageIntegrations ||
    (Boolean(widget.path) &&
      !widget.shortcutOf &&
      canAccessRoute(role, pathOnly(widget.path!), sectionAccess));
  const visibleWidgets = widgets.filter(isVisibleWidget);
  const groups = widgetGroups.filter((group) =>
    visibleWidgets.some((widget) => widget.group === group.id),
  );

  return {
    currentUser,
    sections,
    groups,
    visibleWidgets,
    statuses,
    showStatuses: manageIntegrations,
    canManage: canManageAccess(role),
    showCatalog: manageIntegrations,
    showSettings: canAccessRoute(role, '/settings', sectionAccess),
  };
}

export type NavModel = ReturnType<typeof useNavModel>;
