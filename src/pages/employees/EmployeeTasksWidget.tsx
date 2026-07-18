import { KanbanSquare } from 'lucide-react';
import type { Task } from '@/types';
import { formatRelativeDate } from '@/lib/format';
import { priorityLabels, priorityVariants } from '@/lib/labels';
import { Badge } from '@/components/ui';
import { WidgetCard } from './WidgetCard';

interface EmployeeTasksWidgetProps {
  tasks: Task[];
  footnote?: string;
}

export function EmployeeTasksWidget({
  tasks,
  footnote = 'Открытые задачи сотрудника',
}: EmployeeTasksWidgetProps) {
  return (
    <WidgetCard title="Задачи" icon={KanbanSquare} footnote={footnote}>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">Нет открытых задач.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-800">{task.title}</p>
                {task.dueDate && (
                  <p className="text-xs text-slate-400">до {formatRelativeDate(task.dueDate)}</p>
                )}
              </div>
              <Badge variant={priorityVariants[task.priority]}>
                {priorityLabels[task.priority]}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
