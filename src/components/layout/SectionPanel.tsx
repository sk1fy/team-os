import { Link, useLocation } from 'react-router-dom';
import { WidgetStatusDot } from '@/components/integrations/WidgetStatusDot';
import { cn } from '@/lib/cn';
import { prefetchRoute } from '@/lib/routePrefetch';
import { sectionItemClass } from './chromeSlots';
import { useTabCounts } from './tabCounts';
import {
  isConnectedWidget,
  resolveActiveTab,
  widgetHref,
  type NavLocation,
  type NavTab,
  type WidgetDef,
} from './navigation';
import type { NavModel } from './useNavModel';

function TabList({
  tabs: allTabs,
  nested,
  canManage,
}: {
  tabs: NavTab[];
  nested?: boolean;
  canManage: boolean;
}) {
  const { pathname, search } = useLocation();
  const counts = useTabCounts();
  const tabs = allTabs.filter((tab) => canManage || !tab.manageOnly);
  const active = resolveActiveTab(tabs, pathname, search);
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5',
        nested && 'mt-0.5 mb-2 ml-[19px] border-l border-slate-200 pl-[9px]',
      )}
    >
      {tabs.map((tab) =>
        tab.disabled ? (
          <span
            key={tab.key}
            aria-disabled="true"
            title={tab.hint}
            className={cn(sectionItemClass(false, true), nested && 'py-1.5 text-[13.5px]')}
          >
            <span className="min-w-0 flex-1 truncate">{tab.label}</span>
            {tab.hint && <span className="text-[11px] font-normal text-slate-400">скоро</span>}
          </span>
        ) : (
          <Link
            key={tab.key}
            to={tab.to}
            aria-current={active?.key === tab.key ? 'page' : undefined}
            onMouseEnter={() => prefetchRoute(tab.to.split('?')[0])}
            className={cn(
              sectionItemClass(active?.key === tab.key),
              nested && 'py-1.5 text-[13.5px]',
            )}
          >
            <span className="min-w-0 flex-1 truncate">{tab.label}</span>
            {counts[tab.key] !== undefined && (
              <span className="shrink-0 text-xs font-medium text-slate-400 tabular-nums">
                {counts[tab.key]}
              </span>
            )}
          </Link>
        ),
      )}
    </div>
  );
}

function WidgetItem({
  widget,
  model,
  open,
}: {
  widget: WidgetDef;
  model: NavModel;
  open: boolean;
}) {
  const status = model.statuses[widget.id];
  const connected = isConnectedWidget(widget) || Boolean(widget.shortcutOf);
  const href = widgetHref(widget);
  const title = model.showStatuses
    ? `${widget.title} — ${connected ? status.label : 'появится в TeamOS позже'}`
    : widget.title;
  return (
    <>
      <Link
        to={href}
        title={title}
        aria-current={open ? 'page' : undefined}
        onMouseEnter={() => prefetchRoute(href.split('?')[0])}
        className={cn(sectionItemClass(open), !connected && 'text-slate-400 hover:text-slate-600')}
      >
        {model.showStatuses && (
          <WidgetStatusDot level={connected ? status.level : 'off'} className="mx-1" />
        )}
        <span className="min-w-0 flex-1 truncate">{widget.title}</span>
      </Link>
      {open && widget.tabs && <TabList tabs={widget.tabs} nested canManage={model.canManage} />}
    </>
  );
}

/**
 * Панель раздела: заголовок, вкладки раздела (или виджеты группы интеграций
 * с вложенными вкладками открытого виджета) и слот контекста страницы.
 */
export function SectionPanel({
  model,
  location,
  contextSlotRef,
}: {
  model: NavModel;
  location: NavLocation;
  contextSlotRef: (node: HTMLDivElement | null) => void;
}) {
  const eyebrow =
    location.kind === 'widget'
      ? 'Интеграции'
      : location.kind === 'section'
        ? location.section.eyebrow
        : 'TeamOS';
  const title =
    location.kind === 'widget'
      ? location.group.title
      : location.kind === 'section'
        ? location.section.title
        : '';

  let nav = null;
  if (location.kind === 'section' && location.section.tabs) {
    nav = <TabList tabs={location.section.tabs} canManage={model.canManage} />;
  } else if (location.kind === 'widget') {
    const inGroup = model.visibleWidgets.filter((widget) => widget.group === location.group.id);
    const connected = inGroup.filter((widget) => isConnectedWidget(widget) || widget.shortcutOf);
    const later = inGroup.filter((widget) => !isConnectedWidget(widget) && !widget.shortcutOf);
    nav = (
      <>
        {connected.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {connected.map((widget) => (
              <WidgetItem
                key={widget.id}
                widget={widget}
                model={model}
                open={!widget.shortcutOf && location.widget.id === widget.id}
              />
            ))}
          </div>
        )}
        {later.length > 0 && (
          <>
            <div
              className={cn(
                'mx-2.5 mb-1.5 text-[11px] font-semibold tracking-[0.5px] text-slate-400 uppercase',
                connected.length > 0 && 'mt-5',
              )}
            >
              Скоро в TeamOS
            </div>
            <div className="flex flex-col gap-0.5">
              {later.map((widget) => (
                <WidgetItem
                  key={widget.id}
                  widget={widget}
                  model={model}
                  open={location.widget.id === widget.id}
                />
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <aside
      aria-label="Панель раздела"
      className="flex h-full w-[236px] flex-col overflow-y-auto border-r border-slate-200 bg-surface-muted px-3 py-4"
    >
      {title && (
        <div className="px-2.5 pt-1.5 pb-4">
          <div className="text-xs font-medium text-slate-500">{eyebrow}</div>
          <h2 className="mt-0.5 text-[19px] leading-tight font-bold tracking-[-0.3px] text-ink">
            {title}
          </h2>
        </div>
      )}
      {nav}
      <div ref={contextSlotRef} className="flex flex-col gap-0.5" />
    </aside>
  );
}
