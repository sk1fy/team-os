import { queryKeys } from '@/api/queryKeys';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '@/api';
import type { UserRole } from '@/types';
import { roleLabels } from '@/lib/labels';
import { toast } from '@/stores/toast';
import { Button, Input, Modal, Select } from '@/components/ui';
import { buildPositionOptions, NO_POSITION_VALUE } from './positionSelect';
import { EMAIL_ERROR, PHONE_ERROR, isValidEmail, isValidPhone } from '@/lib/formValidation';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
}

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'admin', label: roleLabels.admin },
  { value: 'employee', label: roleLabels.employee },
  { value: 'partner', label: roleLabels.partner },
];

export function AddUserModal({ open, onClose }: AddUserModalProps) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [positionId, setPositionId] = useState(NO_POSITION_VALUE);
  const [errors, setErrors] = useState<Partial<Record<'firstName' | 'email' | 'phone', string>>>(
    {},
  );
  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const { data: positions } = useQuery({
    queryKey: queryKeys.positions,
    queryFn: orgApi.getPositions,
  });
  const { data: departments } = useQuery({
    queryKey: queryKeys.departments,
    queryFn: orgApi.getDepartments,
  });

  useEffect(() => {
    if (!open) return;
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRole('employee');
    setPositionId(NO_POSITION_VALUE);
    setErrors({});
  }, [open]);

  const positionOptions = useMemo(
    () => buildPositionOptions(positions ?? [], departments ?? []),
    [positions, departments],
  );

  const createUser = useMutation({
    mutationFn: () =>
      orgApi.createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        role,
        positionIds: positionId === NO_POSITION_VALUE ? [] : [positionId],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success('Пользователь добавлен');
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось добавить пользователя'),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!firstName.trim()) nextErrors.firstName = 'Укажите имя пользователя';
    if (!isValidEmail(email)) nextErrors.email = EMAIL_ERROR;
    if (!isValidPhone(phone)) nextErrors.phone = PHONE_ERROR;
    setErrors(nextErrors);
    if (nextErrors.firstName) firstNameRef.current?.focus();
    else if (nextErrors.email) emailRef.current?.focus();
    else if (nextErrors.phone) phoneRef.current?.focus();
    if (Object.keys(nextErrors).length > 0) return;
    createUser.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Добавить пользователя"
      description="Создайте локального пользователя вне CRM."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="add-user-form" loading={createUser.isPending}>
            Добавить
          </Button>
        </>
      }
    >
      <form id="add-user-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Имя"
            ref={firstNameRef}
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              setErrors((current) => ({ ...current, firstName: undefined }));
            }}
            error={errors.firstName}
            required
          />
          <Input
            label="Фамилия"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            hint="Необязательно"
          />
        </div>
        <Input
          label="Email"
          ref={emailRef}
          type="email"
          placeholder="user@company.ru"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          error={errors.email}
          required
        />
        <Input
          label="Телефон"
          ref={phoneRef}
          type="tel"
          placeholder="+7 …"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            setErrors((current) => ({ ...current, phone: undefined }));
          }}
          error={errors.phone}
        />
        <Select
          label="Роль"
          options={roleOptions}
          value={role}
          onValueChange={(value) => setRole(value as UserRole)}
        />
        <Select
          label="Должность"
          options={positionOptions}
          value={positionId}
          onValueChange={setPositionId}
        />
      </form>
    </Modal>
  );
}
