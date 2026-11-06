import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import {
  distributionRuntimeApi as api,
  type DistributionObservation,
  type ObservationAssignmentInput,
} from '@/api/distributionRuntime';
import { queryKeys } from '@/api/queryKeys';
import { Button, Select } from '@/components/ui';
import { fullName } from '@/lib/labels';
import type { User } from '@/types';
import { Failure } from './runtimeShared';

const statusLabels: Record<string, string> = {
  waiting: 'Назначение ожидает обработки.',
  requires_configuration: 'Для назначения требуется настройка.',
  dispatching: 'Назначение ожидает подтверждения amoCRM.',
  confirmed: 'amoCRM подтвердила назначение.',
  cancelled: 'Назначение отменено. Для новой попытки нужна новая запись наблюдения.',
  failed: 'Назначение не выполнено. Для новой попытки нужна новая запись наблюдения.',
  uncertain: 'amoCRM пока не подтвердила результат назначения.',
};

export function ObservationAssignmentControl({
  ruleId,
  observation,
  users,
  crmUsers,
}: {
  ruleId: string;
  observation: DistributionObservation;
  users: User[];
  crmUsers?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string>();
  const [uncertain, setUncertain] = useState<ObservationAssignmentInput>();
  const queryClient = useQueryClient();
  const options = useQuery({
    queryKey: queryKeys.distribution.runtime('observation-assignment', ruleId, observation.id),
    queryFn: ({ signal }) => api.observationAssignment(ruleId, observation.id, signal),
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      ['waiting', 'dispatching', 'uncertain'].includes(query.state.data?.assignment?.state ?? '')
        ? 3000
        : false,
  });
  const submit = useMutation({
    mutationFn: (input: ObservationAssignmentInput) =>
      api.assignObservation(ruleId, observation.id, input),
    onSuccess: () => {
      setUncertain(undefined);
      void options.refetch();
    },
    onError: (error, input) => {
      if (error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.status)) {
        setUncertain(undefined);
        setSelection(undefined);
        void options.refetch();
      } else {
        setUncertain(input);
        void options.refetch();
      }
    },
  });
  const data = options.data;
  const assignment = data?.assignment ?? submit.data;
  const confirmed = open && assignment?.state === 'confirmed';
  useEffect(() => {
    if (confirmed) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.distribution.runtime('observations', ruleId),
      });
    }
  }, [confirmed, queryClient, ruleId]);
  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden="true" />
        Назначить
      </Button>
    );
  }
  const candidates = data?.candidates ?? [];
  const chosen = candidates.find(
    (candidate) => candidate.employeeId === (selection ?? observation.plannedEmployeeId),
  );
  const assignedEmployee = users.find((user) => user.id === assignment?.employeeId);
  const assignedName =
    candidates.find((candidate) => candidate.employeeId === assignment?.employeeId)?.name ??
    (assignedEmployee ? fullName(assignedEmployee) : undefined);
  const currentOwnerKnown = /^[1-9][0-9]{0,18}$/.test(data?.currentResponsibleUserId ?? '');

  return (
    <div className="mt-3 max-w-xl space-y-2.5 rounded-[10px] border border-slate-200 bg-surface-muted p-3.5 text-sm text-ink">
      {assignment ? (
        <p role="status">
          {assignedName ? `${assignedName}. ` : ''}
          {statusLabels[assignment.state] ?? 'Статус назначения уточняется.'}
        </p>
      ) : options.isPending ? (
        <p role="status" className="text-slate-500">
          Проверяем доступных сотрудников…
        </p>
      ) : options.error ? (
        <Failure error={options.error} retry={() => void options.refetch()} />
      ) : (
        data && (
          <>
            <p className="text-slate-600 dark:text-slate-300">
              Текущий ответственный в amoCRM:{' '}
              {crmUsers?.find(({ id }) => id === data.currentResponsibleUserId)?.name ||
                data.currentResponsibleUserId ||
                'Не указан'}
            </p>
            {candidates.length ? (
              <Select
                label="Новый ответственный"
                placeholder="Выберите сотрудника"
                value={chosen?.employeeId ?? ''}
                disabled={submit.isPending || Boolean(uncertain)}
                options={candidates.map(({ employeeId, name }) => ({
                  value: employeeId,
                  label: name,
                }))}
                onValueChange={setSelection}
              />
            ) : (
              <p>Сейчас нет сотрудников, которым можно передать сделку.</p>
            )}
            {!currentOwnerKnown && (
              <p className="text-warning-700 dark:text-amber-300">
                Назначение недоступно, пока amoCRM не вернёт текущего ответственного.
              </p>
            )}
            <Button
              size="sm"
              disabled={submit.isPending || (!uncertain && (!chosen || !currentOwnerKnown))}
              onClick={() => {
                if (uncertain) submit.mutate(uncertain);
                else if (chosen && currentOwnerKnown)
                  submit.mutate({
                    requestId: crypto.randomUUID(),
                    employeeId: chosen.employeeId,
                    expectedResponsibleUserId: data.currentResponsibleUserId,
                  });
              }}
            >
              {uncertain ? 'Проверить назначение повторным запросом' : 'Подтвердить назначение'}
            </Button>
          </>
        )
      )}
      {submit.error && !assignment && (
        <p role="alert" className="text-danger-700 dark:text-red-300">
          {submit.error.message}
        </p>
      )}
    </div>
  );
}
