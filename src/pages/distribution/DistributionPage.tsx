import { queryKeys } from '@/api/queryKeys';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  ChevronRight,
  Pencil,
  Plus,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import { distributionApi, orgApi } from '@/api';
import type { DealDistributionGroup } from '@/types';
import { fullName } from '@/lib/labels';
import { plural } from '@/lib/format';
import { toast } from '@/stores/toast';
import { Avatar, Badge, Button, Modal } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { DistributionGroupModal, type DistributionGroupValues } from './DistributionGroupModal';

const algorithmLabels: Record<DealDistributionGroup['algorithm'], string> = {
  round_robin: 'По очереди',
  least_loaded: 'По наименьшей нагрузке',
  priority: 'С приоритетом',
};

export function DistributionPage() {
  useTitle('Распределение сделок — TeamOS');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DealDistributionGroup | undefined>();
  const [deletingGroup, setDeletingGroup] = useState<DealDistributionGroup | undefined>();
  const createGroupButtonRef = useRef<HTMLButtonElement>(null);

  const groupsQuery = useQuery({
    queryKey: queryKeys.distribution.groups,
    queryFn: distributionApi.getGroups,
  });
  const usersQuery = useQuery({ queryKey: queryKeys.users.all, queryFn: orgApi.getUsers });
  const usersById = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  );

  const createGroup = useMutation({
    mutationFn: (values: DistributionGroupValues) => distributionApi.createGroup(values),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.distribution.groups });
      toast.success('Группа распределения создана');
      setCreateOpen(false);
      navigate(`/distribution/${group.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось создать группу'),
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, values }: { id: string; values: DistributionGroupValues }) =>
      distributionApi.updateGroup({ id, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.distribution.groups });
      toast.success('Группа обновлена');
      setEditingGroup(undefined);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось обновить группу'),
  });

  const deleteGroup = useMutation({
    mutationFn: distributionApi.deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.distribution.groups });
      toast.success('Группа удалена');
      setDeletingGroup(undefined);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить группу'),
  });

  const groups = groupsQuery.data ?? [];
  const isLoading = groupsQuery.isPending || usersQuery.isPending;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Распределение сделок"
        description="Настройте группы сотрудников и правила автоматической передачи новых сделок."
        actions={
          <Button ref={createGroupButtonRef} onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Создать группу
          </Button>
        }
      />

      {isLoading && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-lg bg-slate-200/60" />
          ))}
        </div>
      )}

      {(groupsQuery.isError || usersQuery.isError) && (
        <div className="mt-6">
          <ErrorState
            title="Не удалось загрузить группы"
            onRetry={() => {
              groupsQuery.refetch();
              usersQuery.refetch();
            }}
          />
        </div>
      )}

      {!isLoading && !groupsQuery.isError && !usersQuery.isError && groups.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={Shuffle}
            title="Создайте первую группу"
            description="Добавьте сотрудников и настройте, как между ними будут распределяться новые сделки."
            action={<Button onClick={() => setCreateOpen(true)}>Создать группу</Button>}
          />
        </div>
      )}

      {!isLoading && !groupsQuery.isError && !usersQuery.isError && groups.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {groups.map((group) => {
            const members = group.memberIds.flatMap((id) => {
              const user = usersById.get(id);
              return user ? [user] : [];
            });
            return (
              <article
                key={group.id}
                className="rounded-lg border border-slate-200 bg-surface p-5 shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={group.active ? 'success' : 'neutral'}>
                    {group.active ? 'Активно' : 'Приостановлено'}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditingGroup(group)}>
                      <Pencil className="size-3.5" />
                      Изменить
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger-600 hover:bg-danger-50"
                      onClick={() => setDeletingGroup(group)}
                    >
                      <Trash2 className="size-3.5" />
                      Удалить
                    </Button>
                  </div>
                </div>
                <h2 className="mt-3 text-base font-semibold text-slate-950">{group.name}</h2>
                <p className="mt-1 min-h-10 text-sm text-slate-500">
                  {group.description ?? 'Описание группы пока не добавлено.'}
                </p>
                <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {members.slice(0, 4).map((user) => (
                        <Avatar
                          key={user.id}
                          name={fullName(user)}
                          src={user.avatarUrl}
                          size="sm"
                          className="ring-2 ring-white"
                        />
                      ))}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Users className="size-3.5" />
                      {members.length}{' '}
                      {plural(members.length, ['сотрудник', 'сотрудника', 'сотрудников'])}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <SlidersHorizontal className="size-3.5" />
                    {algorithmLabels[group.algorithm]}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/distribution/${group.id}`)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
                  >
                    Открыть группу
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <DistributionGroupModal
        open={createOpen}
        users={usersQuery.data ?? []}
        pending={createGroup.isPending}
        onClose={() => setCreateOpen(false)}
        onSubmit={(values) => createGroup.mutate(values)}
        restoreFocusRef={createGroupButtonRef}
      />
      <DistributionGroupModal
        open={Boolean(editingGroup)}
        group={editingGroup}
        users={usersQuery.data ?? []}
        pending={updateGroup.isPending}
        onClose={() => setEditingGroup(undefined)}
        onSubmit={(values) => editingGroup && updateGroup.mutate({ id: editingGroup.id, values })}
      />
      <Modal
        open={Boolean(deletingGroup)}
        onOpenChange={(open) => !open && setDeletingGroup(undefined)}
        title="Удалить группу?"
        description="Лента распределения этой группы тоже будет удалена."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingGroup(undefined)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              loading={deleteGroup.isPending}
              onClick={() => deletingGroup && deleteGroup.mutate(deletingGroup.id)}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Группа «{deletingGroup?.name}» исчезнет из списка. Это действие нельзя отменить.
        </p>
      </Modal>
    </div>
  );
}
