import type { ReactNode } from 'react';
import type { ActivityDirectory, ActivityPanelInput } from '@/api/activityControl';
import { Avatar, Badge, Input, Switch } from '@/components/ui';
import { Note } from './shared';
import {
  defaultThresholds,
  setDepartment,
  setOperator,
  thresholdGroups,
  type Options,
  type Thresholds,
} from './model';

function Box({ head, children }: { head: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-slate-200 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">{head}</div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function ThresholdFields({
  value,
  change,
}: {
  value: Thresholds;
  change: (value: Thresholds) => void;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      <Input
        type="number"
        min={0}
        max={86400}
        label="Дозвон, секунд"
        value={value.dialingSeconds}
        onChange={(e) => change({ ...value, dialingSeconds: Number(e.target.value) })}
      />
      <Input
        type="number"
        min={1}
        max={86400}
        label="Разговор, секунд"
        value={value.conversationSeconds}
        onChange={(e) => change({ ...value, conversationSeconds: Number(e.target.value) })}
      />
      <Input
        type="number"
        min={2}
        max={86400}
        label="Превышение, секунд"
        value={value.exceedingSeconds}
        onChange={(e) => change({ ...value, exceedingSeconds: Number(e.target.value) })}
      />
    </div>
  );
}

/** План звонков на день по выбранным сотрудникам (вкладка «Сотрудники»). */
export function CallPlanTable({
  directory,
  employees,
  value,
  change,
}: {
  directory: ActivityDirectory;
  employees: number[];
  value: Options;
  change: (value: Options) => void;
}) {
  const users = directory.users.filter((user) => employees.includes(user.id));
  if (users.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-[13px] font-semibold text-slate-700">План звонков на день</div>
      <div className="overflow-x-auto rounded-[10px] border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-muted text-left text-xs font-semibold text-slate-500">
              <th className="border-b border-slate-200 px-3.5 py-2.5">Сотрудник</th>
              <th className="w-24 border-b border-slate-200 px-3.5 py-2.5 text-center">
                План/факт
              </th>
              <th className="w-32 border-b border-slate-200 px-3.5 py-2.5">План</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const operator = value.operators.find((item) => item.employeeId === user.id);
              return (
                <tr key={user.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3.5 py-2">
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden="true" className="contents">
                        <Avatar name={user.name} size="xs" />
                      </span>
                      <span className="min-w-0 truncate">{user.name}</span>
                    </span>
                  </td>
                  <td className="px-3.5 py-2 text-center">
                    <input
                      type="checkbox"
                      className="size-[17px] accent-primary-600"
                      aria-label={`Учитывать план звонков: ${user.name}`}
                      checked={operator?.enabled ?? false}
                      onChange={(e) =>
                        change(setOperator(value, user.id, { enabled: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="px-3.5 py-2">
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      aria-label={`План звонков: ${user.name}`}
                      value={operator?.plan ?? 100}
                      disabled={!operator?.enabled}
                      onChange={(e) =>
                        change(setOperator(value, user.id, { plan: Number(e.target.value) }))
                      }
                      className="h-8.5 w-24 rounded-md border border-slate-200 bg-surface px-2.5 text-sm text-ink focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600 disabled:bg-slate-50 disabled:text-slate-400 dark:disabled:bg-slate-800"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Пороги длительности звонков: по отделам и по сотрудникам с планом (вкладка «Звонки»). */
export function CallThresholds({
  directory,
  draft,
  change,
}: {
  directory: ActivityDirectory;
  draft: ActivityPanelInput;
  change: (value: Options) => void;
}) {
  const value = draft.options;
  const groups = thresholdGroups(directory, draft);
  const names = new Map(directory.users.map((user) => [user.id, user.name]));
  const operators = value.operators.filter((item) => draft.employeeIds.includes(item.employeeId));
  if (groups.length === 0 && operators.length === 0)
    return <Note>Сначала выберите сотрудников — пороги задаются по их отделам.</Note>;
  return (
    <>
      <p className="text-[13px] text-slate-500">
        Дозвон должен быть короче разговора, а разговор короче порога превышения.
      </p>
      <section className="space-y-2.5" aria-labelledby="activity-departments">
        <h3 id="activity-departments" className="text-[13px] font-semibold text-slate-700">
          Пороги отделов
        </h3>
        {groups.map((group) => {
          const department = value.departments.find((item) => item.groupId === group.id);
          return (
            <Box
              key={group.id}
              head={
                <>
                  <div className="min-w-0">
                    <b className="font-semibold text-ink">{group.name}</b>
                    <div className="text-xs text-slate-500">Сотрудников: {group.selected}</div>
                  </div>
                  <Switch
                    aria-label={`Собственные пороги: ${group.name}`}
                    label="Собственные пороги"
                    className="items-center"
                    checked={!!department}
                    onCheckedChange={(enabled) =>
                      change(setDepartment(value, group.id, enabled ? defaultThresholds() : null))
                    }
                  />
                </>
              }
            >
              {department && (
                <ThresholdFields
                  value={department.thresholds}
                  change={(thresholds) => change(setDepartment(value, group.id, thresholds))}
                />
              )}
            </Box>
          );
        })}
      </section>
      <section className="space-y-2.5" aria-labelledby="activity-operators">
        <h3 id="activity-operators" className="text-[13px] font-semibold text-slate-700">
          Пороги сотрудников
        </h3>
        {operators.length === 0 ? (
          <p className="text-xs text-slate-500">
            Включите план звонков сотруднику на вкладке «Сотрудники», чтобы задать его пороги.
          </p>
        ) : (
          operators.map((operator) => {
            const name = names.get(operator.employeeId) ?? `Сотрудник ${operator.employeeId}`;
            return (
              <Box
                key={operator.employeeId}
                head={
                  <>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden="true" className="contents">
                        <Avatar name={name} size="xs" />
                      </span>
                      <b className="truncate font-semibold text-ink">{name}</b>
                    </span>
                    <Badge variant={operator.enabled ? 'primary' : 'neutral'}>
                      {operator.enabled ? `План ${operator.plan}` : 'План выключен'}
                    </Badge>
                  </>
                }
              >
                <ThresholdFields
                  value={operator.thresholds}
                  change={(thresholds) =>
                    change(setOperator(value, operator.employeeId, { thresholds }))
                  }
                />
              </Box>
            );
          })
        )}
      </section>
    </>
  );
}
