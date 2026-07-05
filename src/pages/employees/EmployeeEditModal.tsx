import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, orgApi } from '@/api';
import type { ID, User, UserRole, UserStatus } from '@/types';
import { roleLabels } from '@/lib/labels';
import { toast } from '@/stores/toast';
import { Button, Input, Modal, Select } from '@/components/ui';

interface EmployeeEditModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'owner', label: roleLabels.owner },
  { value: 'admin', label: roleLabels.admin },
  { value: 'employee', label: roleLabels.employee },
  { value: 'partner', label: roleLabels.partner },
];

const statusOptions: { value: UserStatus; label: string }[] = [
  { value: 'active', label: 'Активен' },
  { value: 'invited', label: 'Приглашён' },
  { value: 'deactivated', label: 'Деактивирован' },
];

export function EmployeeEditModal({ user, open, onClose }: EmployeeEditModalProps) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [status, setStatus] = useState<UserStatus>('active');
  const [positionIds, setPositionIds] = useState<ID[]>([]);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const { data: company } = useQuery({ queryKey: ['company'], queryFn: authApi.getCompany });
  const { data: positions } = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: orgApi.getDepartments,
  });
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
  });

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(user.phone ?? '');
    setRole(user.role);
    setStatus(user.status);
    setPositionIds(user.positionIds);
    setConfirmDeactivate(false);
  }, [user]);

  const isOwner = user?.id === company?.ownerId;
  const isSelf = user?.id === currentUser?.id;

  const positionOptions = useMemo(() => {
    const departmentName = (id: string) => departments?.find((d) => d.id === id)?.name;
    return (positions ?? []).map((position) => ({
      value: position.id,
      label: departmentName(position.departmentId)
        ? `${position.name} — ${departmentName(position.departmentId)}`
        : position.name,
    }));
  }, [positions, departments]);

  const availableRoles = useMemo(() => {
    if (isOwner) return roleOptions.filter((option) => option.value === 'owner');
    if (isSelf) return roleOptions.filter((option) => option.value === user?.role);
    return roleOptions.filter((option) => option.value !== 'owner');
  }, [isOwner, isSelf, user?.role]);

  const availableStatuses = useMemo(() => {
    if (isOwner || isSelf) return statusOptions.filter((option) => option.value === 'active');
    return statusOptions;
  }, [isOwner, isSelf]);

  const togglePosition = (positionId: ID) => {
    setPositionIds((prev) =>
      prev.includes(positionId) ? prev.filter((id) => id !== positionId) : [...prev, positionId],
    );
  };

  const save = useMutation({
    mutationFn: () =>
      orgApi.updateUser({
        id: user!.id,
        firstName,
        lastName,
        phone,
        role,
        status,
        positionIds,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', updated.id] });
      toast.success('Профиль обновлён');
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить изменения'),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (status === 'deactivated' && user.status !== 'deactivated' && !confirmDeactivate) {
      setConfirmDeactivate(true);
      return;
    }
    save.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Редактировать профиль"
      description={user ? `${user.email}` : undefined}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="employee-edit-form"
            variant={confirmDeactivate ? 'danger' : 'primary'}
            loading={save.isPending}
          >
            {confirmDeactivate ? 'Подтвердить деактивацию' : 'Сохранить'}
          </Button>
        </>
      }
    >
      {user && (
        <form id="employee-edit-form" onSubmit={handleSubmit} className="space-y-4">
          {confirmDeactivate && (
            <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
              Сотрудник потеряет доступ к компании. Продолжить?
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Имя"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label="Фамилия"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <Input
            label="Телефон"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 …"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Роль"
              options={availableRoles}
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
            />
            <Select
              label="Статус"
              options={availableStatuses}
              value={status}
              onValueChange={(value) => {
                setStatus(value as UserStatus);
                setConfirmDeactivate(false);
              }}
            />
          </div>
          {positionOptions.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Должности</p>
              <div className="flex flex-wrap gap-2">
                {positionOptions.map((option) => {
                  const active = positionIds.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => togglePosition(option.value)}
                      className={`rounded-md border px-2.5 py-1 text-sm transition-colors ${
                        active
                          ? 'border-primary-300 bg-primary-50 text-primary-800'
                          : 'border-slate-200 bg-surface text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
