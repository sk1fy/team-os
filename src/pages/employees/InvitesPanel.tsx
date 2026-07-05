import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Mail, RotateCw, X } from 'lucide-react';
import { orgApi } from '@/api';
import type { Invite, InviteStatus } from '@/types';
import { formatRelativeDate } from '@/lib/format';
import { roleLabels, roleVariants } from '@/lib/labels';
import { toast } from '@/stores/toast';
import { Badge, Button, Modal } from '@/components/ui';

const inviteStatusLabels: Record<InviteStatus, string> = {
  pending: 'Ожидает',
  accepted: 'Принято',
  expired: 'Истекло',
};

const inviteStatusVariants: Record<InviteStatus, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  accepted: 'success',
  expired: 'neutral',
};

export function InvitesPanel() {
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null);

  const invitesQuery = useQuery({ queryKey: ['invites'], queryFn: orgApi.getInvites });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: orgApi.getDepartments,
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });

  const positionById = useMemo(
    () => new Map((positionsQuery.data ?? []).map((p) => [p.id, p])),
    [positionsQuery.data],
  );
  const departmentById = useMemo(
    () => new Map((departmentsQuery.data ?? []).map((d) => [d.id, d])),
    [departmentsQuery.data],
  );

  const invitedUsersByEmail = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) {
      if (user.status === 'invited') map.set(user.email.toLowerCase(), user.id);
    }
    return map;
  }, [usersQuery.data]);

  const resend = useMutation({
    mutationFn: orgApi.resendInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      toast.success('Приглашение отправлено повторно');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось отправить приглашение'),
  });

  const revoke = useMutation({
    mutationFn: orgApi.revokeInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Приглашение отозвано');
      setRevokeTarget(null);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось отозвать приглашение'),
  });

  const inviteLabel = (invite: Invite) => {
    if (invite.email) return invite.email;
    return 'Ссылка-приглашение';
  };

  const inviteMeta = (invite: Invite) => {
    const position = invite.positionId ? positionById.get(invite.positionId) : undefined;
    const department = invite.departmentId
      ? departmentById.get(invite.departmentId)
      : position
        ? departmentById.get(position.departmentId)
        : undefined;
    const parts = [
      roleLabels[invite.role],
      position?.name,
      department?.name,
    ].filter(Boolean);
    return parts.join(' · ');
  };

  const reconcileNote = (invite: Invite) => {
    if (!invite.email || invite.status !== 'pending') return null;
    const userId = invitedUsersByEmail.get(invite.email.toLowerCase());
    return userId ? 'Сотрудник в списке со статусом «Приглашён»' : 'Нет связанного сотрудника';
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-surface shadow-card">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-400 uppercase">
              <th className="px-4 py-3 font-semibold">Приглашение</th>
              <th className="px-4 py-3 font-semibold">Роль</th>
              <th className="px-4 py-3 font-semibold">Статус</th>
              <th className="px-4 py-3 font-semibold">Отправлено</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {invitesQuery.isPending &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-8 animate-pulse rounded bg-slate-200/60" />
                  </td>
                </tr>
              ))}

            {invitesQuery.isError && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="text-sm text-danger-700">Не удалось загрузить приглашения.</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => invitesQuery.refetch()}
                  >
                    Повторить
                  </Button>
                </td>
              </tr>
            )}

            {invitesQuery.isSuccess && (invitesQuery.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Активных приглашений нет.
                </td>
              </tr>
            )}

            {(invitesQuery.data ?? []).map((invite) => {
              const note = reconcileNote(invite);
              return (
                <tr key={invite.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {invite.email ? (
                        <Mail className="mt-0.5 size-4 shrink-0 text-slate-400" />
                      ) : (
                        <Link2 className="mt-0.5 size-4 shrink-0 text-slate-400" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {inviteLabel(invite)}
                        </p>
                        <p className="truncate text-xs text-slate-500">{inviteMeta(invite)}</p>
                        {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={roleVariants[invite.role]}>{roleLabels[invite.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={inviteStatusVariants[invite.status]}>
                      {inviteStatusLabels[invite.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatRelativeDate(invite.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {invite.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={resend.isPending && resend.variables === invite.id}
                          onClick={() => resend.mutate(invite.id)}
                        >
                          <RotateCw className="size-4" />
                          Повторить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevokeTarget(invite)}
                        >
                          <X className="size-4" />
                          Отозвать
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {revokeTarget && (
        <Modal
          open
          onOpenChange={(open) => !open && setRevokeTarget(null)}
          title="Отозвать приглашение?"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRevokeTarget(null)}>
                Отмена
              </Button>
              <Button
                variant="danger"
                loading={revoke.isPending}
                onClick={() => revoke.mutate(revokeTarget.id)}
              >
                Отозвать
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            {revokeTarget.email
              ? `Приглашение для ${revokeTarget.email} будет помечено как истекшее.`
              : 'Ссылка-приглашение перестанет работать.'}
          </p>
        </Modal>
      )}
    </>
  );
}