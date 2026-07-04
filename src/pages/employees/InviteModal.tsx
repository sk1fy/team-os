import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCopyToClipboard } from '@reactuses/core';
import { Check, Copy, Link2 } from 'lucide-react';
import { orgApi } from '@/api';
import type { UserRole } from '@/types';
import { toast } from '@/stores/toast';
import { Button, Input, Modal, Select, Tabs } from '@/components/ui';

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

const roleOptions = [
  { value: 'employee', label: 'Сотрудник' },
  { value: 'admin', label: 'Администратор' },
  { value: 'partner', label: 'Партнёр' },
];

export function InviteModal({ open, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('employee');
  const [positionId, setPositionId] = useState<string>('none');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, copyToClipboard] = useCopyToClipboard();

  const { data: positions } = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: orgApi.getDepartments,
  });

  const positionOptions = useMemo(() => {
    const departmentName = (id: string) => departments?.find((d) => d.id === id)?.name;
    return [
      { value: 'none', label: 'Без должности' },
      ...(positions ?? []).map((p) => ({
        value: p.id,
        label: departmentName(p.departmentId) ? `${p.name} — ${departmentName(p.departmentId)}` : p.name,
      })),
    ];
  }, [positions, departments]);

  const inviteInput = () => ({
    role: role as UserRole,
    positionId: positionId === 'none' ? undefined : positionId,
    departmentId:
      positionId === 'none' ? undefined : positions?.find((p) => p.id === positionId)?.departmentId,
  });

  const sendInvite = useMutation({
    mutationFn: orgApi.inviteUser,
    onSuccess: () => {
      toast.success('Приглашение отправлено', `Письмо ушло на ${email}`);
      handleClose();
    },
    onError: () => toast.error('Не удалось отправить приглашение'),
  });

  const createLink = useMutation({
    mutationFn: orgApi.inviteUser,
    onSuccess: (invite) => {
      setInviteLink(`${window.location.origin}/auth/invite/${invite.token}`);
    },
    onError: () => toast.error('Не удалось создать ссылку'),
  });

  const handleClose = () => {
    setEmail('');
    setRole('employee');
    setPositionId('none');
    setInviteLink(null);
    onClose();
  };

  const handleEmailSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendInvite.mutate({ email, ...inviteInput() });
  };

  const commonFields = (
    <>
      <Select label="Роль" options={roleOptions} value={role} onValueChange={setRole} />
      <Select
        label="Должность"
        options={positionOptions}
        value={positionId}
        onValueChange={setPositionId}
      />
    </>
  );

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => !isOpen && handleClose()}
      title="Пригласить в компанию"
      description="Новый сотрудник получит доступ после принятия приглашения."
    >
      <Tabs
        items={[
          {
            value: 'email',
            label: 'По email',
            content: (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="colleague@company.ru"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {commonFields}
                <div className="flex justify-end pt-2">
                  <Button type="submit" loading={sendInvite.isPending}>
                    Отправить приглашение
                  </Button>
                </div>
              </form>
            ),
          },
          {
            value: 'link',
            label: 'По ссылке',
            content: (
              <div className="space-y-4">
                {commonFields}
                {inviteLink ? (
                  <div className="flex items-end gap-2">
                    <Input label="Ссылка-приглашение" readOnly value={inviteLink} className="flex-1" />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        copyToClipboard(inviteLink);
                        toast.success('Ссылка скопирована');
                      }}
                      aria-label="Скопировать ссылку"
                    >
                      {copied === inviteLink ? (
                        <Check className="size-4 text-success-600" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-end pt-2">
                    <Button
                      loading={createLink.isPending}
                      onClick={() => createLink.mutate(inviteInput())}
                    >
                      <Link2 className="size-4" />
                      Создать ссылку
                    </Button>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}
