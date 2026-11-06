import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, Clock } from 'lucide-react';
import { useTitle } from '@reactuses/core';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  isConnectedWidget,
  widgetById,
  widgetGroups,
  widgetHref,
  widgets,
} from '@/components/layout/navigation';
import { useNavModel } from '@/components/layout/useNavModel';
import { WidgetStatusDot } from '@/components/integrations/WidgetStatusDot';
import { Badge } from '@/components/ui';

const card = 'rounded-xl border border-slate-200 bg-surface shadow-card';
const connectedWidgets = widgets.filter(isConnectedWidget);

/**
 * Описание виджета, который ещё нельзя подключить и настроить в TeamOS:
 * что он умеет и что уже работает в TeamOS.
 */
export function WidgetInfoPage() {
  const { widgetId = '' } = useParams();
  const widget = widgetById(widgetId);
  const { statuses } = useNavModel();
  useTitle(`${widget?.title ?? 'Виджет'} — TeamOS`);

  if (!widget) return <Navigate to="/integrations" replace />;
  if (isConnectedWidget(widget) || widget.shortcutOf)
    return <Navigate to={widgetHref(widget)} replace />;

  const group = widgetGroups.find((item) => item.id === widget.group)!;

  return (
    <div className="max-w-[1360px] px-4 pt-5 pb-14 sm:px-6">
      <PageHeader title={widget.title} description={widget.summary} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className={`${card} p-5`} aria-labelledby="widget-about">
          <h2 id="widget-about" className="text-[15px] font-semibold tracking-normal">
            О виджете
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200">
              <widget.icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <b className="block text-base font-semibold text-ink">{widget.title}</b>
              <span className="text-[13px] text-slate-500">{group.title} · amoCRM</span>
            </div>
            <Badge>Скоро в TeamOS</Badge>
          </div>

          <p className="mt-4 leading-relaxed text-slate-600">{widget.summary}</p>

          {widget.features && widget.features.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 text-[11px] font-semibold tracking-[0.5px] text-slate-400 uppercase">
                Что умеет
              </h3>
              <ul className="space-y-1">
                {widget.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 py-1">
                    <Check className="mt-0.5 size-4 shrink-0 text-success-700" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 flex items-start gap-2.5 rounded-[10px] bg-primary-50 px-3.5 py-3 text-[13.5px] text-primary-800 dark:bg-primary-900 dark:text-primary-100">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span>
              Подключение и настройка этого виджета через TeamOS появятся позже. Когда виджет станет
              доступен, здесь появятся его настройки.
            </span>
          </div>
        </section>

        <section className={`${card} p-5`} aria-labelledby="widget-connected">
          <h2 id="widget-connected" className="text-[15px] font-semibold tracking-normal">
            Уже работает в TeamOS
          </h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {connectedWidgets.map((item) => (
              <li key={item.id}>
                <Link
                  to={widgetHref(item)}
                  className="group flex items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-primary-600"
                >
                  <WidgetStatusDot level={statuses[item.id].level} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{item.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {statuses[item.id].label}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-slate-400 group-hover:text-primary-700" />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/integrations"
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700 hover:underline"
          >
            Каталог виджетов <ArrowRight className="size-3.5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
