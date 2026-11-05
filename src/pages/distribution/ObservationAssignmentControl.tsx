import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  cancelled: 'Назначение отменено.',
  failed: 'Назначение не выполнено.',
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
  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
        Назначить
      </Button>
    );
  }
  const data = options.data;
  const assignment = data?.assignment ?? submit.data;
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
    <div className="mt-3 space-y-2 rounded-md border border-slate-200 p-3 text-sm">
      {assignment ? (
        <p role="status">
          {assignedName ? `${assignedName}. ` : ''}
          {statusLabels[assignment.state] ?? 'Статус назначения уточняется.'}
        </p>
      ) : options.isPending ? (
        <p role="status">Проверяем доступных сотрудников…</p>
      ) : options.error ? (
        <Failure error={options.error} retry={() => void options.refetch()} />
      ) : (
        data && (
          <>
            <p>
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
              <p>Назначение недоступно, пока amoCRM не вернёт текущего ответственного.</p>
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
      {submit.error && !assignment && <p role="alert">{submit.error.message}</p>}
    </div>
  );
}
