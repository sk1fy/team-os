import type { LucideIcon } from 'lucide-react';
import { useTitle } from '@reactuses/core';
import { Badge } from '@/components/ui';
import { PageHeader } from './PageHeader';

export interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Номер этапа плана, на котором модуль будет реализован. */
  stage: number;
}

/** Заглушка модуля до его реализации в соответствующем этапе плана. */
export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  stage,
}: ModulePlaceholderProps) {
  useTitle(`${title} — TeamOS`);

  return (
    <div className="p-6">
      <PageHeader title={title} description={description} />
      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-50">
          <Icon className="size-8 text-primary-500" />
        </div>
        <div>
          <p className="font-medium text-slate-700">Раздел в разработке</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Каркас готов — функциональность появится в этапе {stage} плана разработки.
          </p>
        </div>
        <Badge variant="primary">Этап {stage}</Badge>
      </div>
    </div>
  );
}
