import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTitle } from '@reactuses/core';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  SectionContext,
  SectionContextHeading,
  SectionContextItem,
} from '@/components/layout/pageChrome';
import {
  isConnectedWidget,
  widgetGroups,
  widgetHref,
  widgets,
  type WidgetDef,
} from '@/components/layout/navigation';
import { useNavModel } from '@/components/layout/useNavModel';
import { WidgetStatusDot } from '@/components/integrations/WidgetStatusDot';
import type { WidgetStatus } from '@/components/integrations/widgetStatus';
import { cn } from '@/lib/cn';

type CatalogFilter = 'all' | 'connected' | 'soon';

const filters: { key: CatalogFilter; label: string }[] = [
  { key: 'all', label: 'Все виджеты' },
  { key: 'connected', label: 'Подключены' },
  { key: 'soon', label: 'Скоро в TeamOS' },
];

// Ярлыки (например, «Очередь задач») — часть другого виджета, в каталоге их нет.
const catalogWidgets = widgets.filter((widget) => !widget.shortcutOf);

const matchesFilter = (widget: WidgetDef, filter: CatalogFilter) =>
  filter === 'all' || (filter === 'connected') === isConnectedWidget(widget);

function WidgetCard({ widget, status }: { widget: WidgetDef; status: WidgetStatus }) {
  const connected = isConnectedWidget(widget);
  return (
    <Link
      to={widgetHref(widget)}
      className="group flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-surface px-[18px] py-4 shadow-card transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex size-[34px] items-center justify-center rounded-[9px]',
            connected
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
              : 'bg-slate-100 text-slate-500',
          )}
        >
          <widget.icon className="size-4" />
        </span>
      </div>
      <b className="text-[15px] font-semibold text-ink">{widget.title}</b>
      <p className="flex-1 text-[13px] leading-normal text-slate-500">{widget.summary}</p>
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[13px]">
        <span className="flex min-w-0 items-center gap-2 text-slate-600">
          <WidgetStatusDot level={connected ? status.level : 'off'} />
          <span className="truncate">{connected ? status.label : 'Скоро в TeamOS'}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-semibold text-ink group-hover:text-primary-700">
          {connected ? 'Открыть' : 'Подробнее'}
          <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}

/** Каталог виджетов amoCRM: подключённые в TeamOS и те, что появятся позже. */
export function CatalogPage() {
  useTitle('Каталог виджетов — TeamOS');
  const [params, setParams] = useSearchParams();
  const { statuses } = useNavModel();
  const raw = params.get('show');
  const filter: CatalogFilter = raw === 'connected' || raw === 'soon' ? raw : 'all';
  const count = (key: CatalogFilter) =>
    catalogWidgets.filter((widget) => matchesFilter(widget, key)).length;

  const sections = widgetGroups
    .map((group) => ({
      group,
      list: catalogWidgets.filter(
        (widget) => widget.group === group.id && matchesFilter(widget, filter),
      ),
    }))
    .filter((section) => section.list.length > 0);

  return (
    <div className="max-w-[1360px] px-4 pt-5 pb-14 sm:px-6">
      <PageHeader
        title="Каталог виджетов"
        description="Все виджеты TeamOS для amoCRM: что уже работает и что появится в TeamOS."
      />
      <SectionContext>
        <SectionContextHeading>Показать</SectionContextHeading>
        {filters.map((item) => (
          <SectionContextItem
            key={item.key}
            active={filter === item.key}
            count={count(item.key)}
            onClick={() =>
              setParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  if (item.key === 'all') next.delete('show');
                  else next.set('show', item.key);
                  return next;
                },
                { replace: true },
              )
            }
          >
            {item.label}
          </SectionContextItem>
        ))}
      </SectionContext>

      <div className="flex flex-col gap-6">
        {sections.map(({ group, list }) => (
          <section key={group.id} aria-labelledby={`catalog-${group.id}`}>
            <h2
              id={`catalog-${group.id}`}
              className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold tracking-normal text-slate-600"
            >
              <group.icon className="size-4" />
              {group.title}
              <span className="font-medium text-slate-400">{list.length}</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((widget) => (
                <WidgetCard key={widget.id} widget={widget} status={statuses[widget.id]} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
