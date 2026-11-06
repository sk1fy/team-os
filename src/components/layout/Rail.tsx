import { Link } from 'react-router-dom';
import { LogOut, type LucideIcon } from 'lucide-react';
import { groupLevel } from '@/components/integrations/widgetStatus';
import { useLogout } from '@/components/auth/useLogout';
import { cn } from '@/lib/cn';
import { prefetchRoute } from '@/lib/routePrefetch';
import { safeHomePath } from '@/lib/permissions';
import { BrandMark } from './BrandMark';
import {
  catalogSection,
  groupHomeHref,
  isConnectedWidget,
  settingsSection,
  widgetHref,
  type NavLocation,
  type WidgetGroup,
} from './navigation';
import type { NavModel } from './useNavModel';

const itemClass = (active: boolean) =>
  cn(
    'relative flex w-16 shrink-0 flex-col items-center gap-1 overflow-visible rounded-[10px] px-0 pt-2 pb-[7px] text-[10.5px] leading-tight font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-600',
    active
      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
      : 'text-slate-500 hover:bg-slate-100 hover:text-ink',
  );

function RailLink({
  to,
  label,
  title,
  icon: Icon,
  active,
  dot,
}: {
  to: string;
  label: string;
  title: string;
  icon: LucideIcon;
  active: boolean;
  dot?: 'warn' | 'setup' | null;
}) {
  return (
    <Link
      to={to}
      title={title}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => prefetchRoute(to.split('?')[0])}
      onFocus={() => prefetchRoute(to.split('?')[0])}
      className={itemClass(active)}
    >
      <Icon className="size-[18px]" strokeWidth={1.8} />
      <span className="whitespace-nowrap tracking-[-0.2px]">{label}</span>
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1.5 right-4 size-2 rounded-full border-2 border-surface',
            dot === 'warn' ? 'bg-warning-500' : 'bg-sky-600',
          )}
        />
      )}
    </Link>
  );
}

/** Рейл: разделы TeamOS, группы интеграций, каталог, настройки и выход. */
export function Rail({ model, location }: { model: NavModel; location: NavLocation }) {
  const logout = useLogout();
  const sectionActive = (id: string) => location.kind === 'section' && location.section.id === id;
  const groupActive = (group: WidgetGroup) =>
    location.kind === 'widget' && location.group.id === group.id;

  // Неуправляющим ролям группа ведёт на первый доступный им виджет.
  const groupHref = (group: WidgetGroup) => {
    if (model.showCatalog) return groupHomeHref(group.id);
    const first = model.visibleWidgets.find(
      (widget) => widget.group === group.id && isConnectedWidget(widget),
    );
    return first ? widgetHref(first) : groupHomeHref(group.id);
  };

  return (
    <nav
      aria-label="Разделы"
      className="flex h-full w-[76px] flex-col items-center gap-0.5 overflow-y-auto border-r border-slate-200 bg-surface px-1.5 py-3"
    >
      <Link
        to={safeHomePath(model.currentUser?.role, model.currentUser?.sectionAccess)}
        className="mb-3 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        aria-label="TeamOS — на главную"
      >
        <BrandMark className="size-9 rounded-[9px]" />
      </Link>

      {model.sections.map((section) =>
        section.disabled ? (
          <div
            key={section.id}
            className={cn(itemClass(false), 'cursor-default opacity-40 hover:bg-transparent')}
            title={`${section.title} — ${section.hint ?? 'в разработке'}`}
            aria-disabled="true"
          >
            <section.icon className="size-[18px]" strokeWidth={1.8} />
            <span className="whitespace-nowrap tracking-[-0.2px]">{section.railLabel}</span>
          </div>
        ) : (
          <RailLink
            key={section.id}
            to={section.path}
            label={section.railLabel}
            title={section.badge ? `${section.title} · ${section.badge}` : section.title}
            icon={section.icon}
            active={sectionActive(section.id)}
          />
        ),
      )}

      {model.groups.length > 0 && (
        <>
          <div className="mt-2 mb-1 w-14 border-t border-slate-200 pt-2.5 text-center text-[8.5px] font-semibold tracking-[0.3px] text-slate-400 uppercase">
            Интеграции
          </div>
          {model.groups.map((group) => (
            <RailLink
              key={group.id}
              to={groupHref(group)}
              label={group.railLabel}
              title={group.title}
              icon={group.icon}
              active={groupActive(group)}
              dot={model.showStatuses ? groupLevel(group.id, model.statuses) : null}
            />
          ))}
          {model.showCatalog && (
            <RailLink
              to={catalogSection.path}
              label={catalogSection.railLabel}
              title={catalogSection.title}
              icon={catalogSection.icon}
              active={sectionActive('catalog')}
            />
          )}
        </>
      )}

      <div className="min-h-3 flex-1" />

      {model.showSettings && (
        <RailLink
          to={settingsSection.path}
          label={settingsSection.railLabel}
          title={settingsSection.title}
          icon={settingsSection.icon}
          active={sectionActive('settings')}
        />
      )}
      <button
        type="button"
        onClick={() => void logout()}
        className={cn(itemClass(false), 'hover:bg-danger-50 hover:text-danger-600')}
        title="Выйти из TeamOS"
      >
        <LogOut className="size-[18px]" strokeWidth={1.8} />
        <span>Выйти</span>
      </button>
    </nav>
  );
}
