import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '@/api';
import type { ID, Position, User } from '@/types';
import { fullName } from '@/lib/labels';
import { toast } from '@/stores/toast';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import type { StructureDialog } from './types';

interface StructureDialogsProps {
  dialog: StructureDialog | null;
  onClose: () => void;
}

interface FormModalProps {
  title: string;
  submitLabel: string;
  initialName?: string;
  initialDescription?: string;
  initialValuableFinalProduct?: string;
  initialLevel?: Position['level'];
  initialHeadUserId?: ID;
  initialDepartmentId?: ID;
  withLevel?: boolean;
  withDescription?: boolean;
  withValuableFinalProduct?: boolean;
  withHead?: boolean;
  withDepartment?: boolean;
  headOptions?: Array<{ value: string; label: string }>;
  departmentOptions?: Array<{ value: string; label: string }>;
  pending: boolean;
  onSubmit: (values: {
    name: string;
    description: string;
    valuableFinalProduct: string;
    level: Position['level'];
    headUserId: ID | null;
    departmentId: ID;
  }) => void;
  onClose: () => void;
}

const positionLevelOptions = [
  { value: '4', label: 'Уровень 4 — руководство компании' },
  { value: '3', label: 'Уровень 3 — руководитель направления' },
  { value: '2', label: 'Уровень 2 — руководитель команды' },
  { value: '1', label: 'Уровень 1 — ведущий специалист' },
  { value: '0', label: 'Уровень 0 — специалист' },
];

const NO_HEAD_VALUE = '__no_head__';

function FormModal({
  title,
  submitLabel,
  initialName = '',
  initialDescription = '',
  initialValuableFinalProduct = '',
  initialLevel = 0,
  initialHeadUserId,
  initialDepartmentId = '',
  withLevel = false,
  withDescription = false,
  withValuableFinalProduct = false,
  withHead = false,
  withDepartment = false,
  headOptions = [],
  departmentOptions = [],
  pending,
  onSubmit,
  onClose,
}: FormModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [valuableFinalProduct, setValuableFinalProduct] = useState(initialValuableFinalProduct);
  const [level, setLevel] = useState(String(initialLevel));
  const [headUserId, setHeadUserId] = useState(initialHeadUserId ?? NO_HEAD_VALUE);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) {
      onSubmit({
        name: name.trim(),
        description: description.trim(),
        valuableFinalProduct: valuableFinalProduct.trim(),
        level: Number(level) as Position['level'],
        headUserId: headUserId === NO_HEAD_VALUE ? null : headUserId,
        departmentId,
      });
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="structure-form"
            loading={pending}
            disabled={!name.trim() || (withDepartment && !departmentId)}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="structure-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
        {withDepartment && (
          <Select
            label="Отдел"
            value={departmentId}
            onValueChange={setDepartmentId}
            options={departmentOptions}
          />
        )}
        {withLevel && (
          <Select
            label="Уровень должности"
            value={level}
            onValueChange={setLevel}
            options={positionLevelOptions}
          />
        )}
        {withHead && (
          <Select
            label="Руководитель"
            value={headUserId}
            onValueChange={setHeadUserId}
            options={[{ value: NO_HEAD_VALUE, label: 'Не назначен' }, ...headOptions]}
          />
        )}
        {withValuableFinalProduct && (
          <Textarea
            label="ЦКП отдела"
            value={valuableFinalProduct}
            onChange={(e) => setValuableFinalProduct(e.target.value)}
            placeholder="Например: стабильный поток квалифицированных заявок для отдела продаж"
            rows={3}
          />
        )}
        {withDescription && (
          <Textarea
            label="Описание функций"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="За что отвечает эта должность…"
          />
        )}
      </form>
    </Modal>
  );
}

interface ConfirmModalProps {
  title: string;
  text: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmModal({
  title,
  text,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="danger" loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{text}</p>
    </Modal>
  );
}

export function StructureDialogs({ dialog, onClose }: StructureDialogsProps) {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: orgApi.getDepartments,
  });

  const headOptions = (usersQuery.data ?? [])
    .filter((user: User) => user.status === 'active' && user.role !== 'partner')
    .sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'))
    .map((user) => ({ value: user.id, label: fullName(user) }));
  const departmentOptions = (departmentsQuery.data ?? []).map((department) => ({
    value: department.id,
    label: department.name,
  }));

  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : 'Что-то пошло не так');

  const done = (queryKey: string, message: string) => {
    queryClient.invalidateQueries({ queryKey: [queryKey] });
    toast.success(message);
    onClose();
  };

  const createDepartment = useMutation({
    mutationFn: orgApi.createDepartment,
    onSuccess: () => done('departments', 'Отдел создан'),
    onError,
  });
  const updateDepartment = useMutation({
    mutationFn: orgApi.updateDepartment,
    onSuccess: () => done('departments', 'Настройки отдела сохранены'),
    onError,
  });
  const deleteDepartment = useMutation({
    mutationFn: orgApi.deleteDepartment,
    onSuccess: () => done('departments', 'Отдел удалён'),
    onError,
  });
  const createPosition = useMutation({
    mutationFn: orgApi.createPosition,
    onSuccess: () => done('positions', 'Должность создана'),
    onError,
  });
  const updatePosition = useMutation({
    mutationFn: orgApi.updatePosition,
    onSuccess: () => done('positions', 'Должность обновлена'),
    onError,
  });
  const deletePosition = useMutation({
    mutationFn: orgApi.deletePosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      done('positions', 'Должность удалена');
    },
    onError,
  });

  if (!dialog) return null;

  switch (dialog.type) {
    case 'createDepartment':
      return (
        <FormModal
          title="Новый отдел"
          submitLabel="Создать"
          withHead
          withValuableFinalProduct
          headOptions={headOptions}
          pending={createDepartment.isPending}
          onSubmit={({ name, headUserId, valuableFinalProduct }) =>
            createDepartment.mutate({
              name,
              parentId: dialog.parentId,
              headUserId: headUserId ?? undefined,
              valuableFinalProduct: valuableFinalProduct || undefined,
            })
          }
          onClose={onClose}
        />
      );
    case 'editDepartment':
      return (
        <FormModal
          title="Настройки отдела"
          submitLabel="Сохранить"
          initialName={dialog.department.name}
          initialHeadUserId={dialog.department.headUserId}
          initialValuableFinalProduct={dialog.department.valuableFinalProduct}
          withHead
          withValuableFinalProduct
          headOptions={headOptions}
          pending={updateDepartment.isPending}
          onSubmit={({ name, headUserId, valuableFinalProduct }) =>
            updateDepartment.mutate({
              id: dialog.department.id,
              name,
              headUserId,
              valuableFinalProduct: valuableFinalProduct || null,
            })
          }
          onClose={onClose}
        />
      );
    case 'deleteDepartment':
      return (
        <ConfirmModal
          title="Удалить отдел?"
          text={`Отдел «${dialog.department.name}» будет удалён. Действие нельзя отменить.`}
          confirmLabel="Удалить"
          pending={deleteDepartment.isPending}
          onConfirm={() => deleteDepartment.mutate(dialog.department.id)}
          onClose={onClose}
        />
      );
    case 'createPosition':
      return (
        <FormModal
          title="Новая должность"
          submitLabel="Создать"
          withLevel
          withDescription
          withDepartment
          initialDepartmentId={dialog.departmentId}
          departmentOptions={departmentOptions}
          pending={createPosition.isPending}
          onSubmit={({ name, description, level, departmentId }) =>
            createPosition.mutate({ name, description, level, departmentId })
          }
          onClose={onClose}
        />
      );
    case 'editPosition':
      return (
        <FormModal
          title="Редактировать должность"
          submitLabel="Сохранить"
          initialName={dialog.position.name}
          initialDescription={dialog.position.description}
          initialLevel={dialog.position.level ?? 0}
          initialDepartmentId={dialog.position.departmentId}
          withLevel
          withDescription
          withDepartment
          departmentOptions={departmentOptions}
          pending={updatePosition.isPending}
          onSubmit={({ name, description, level, departmentId }) =>
            updatePosition.mutate({
              id: dialog.position.id,
              name,
              description,
              level,
              departmentId,
            })
          }
          onClose={onClose}
        />
      );
    case 'deletePosition':
      return (
        <ConfirmModal
          title="Удалить должность?"
          text={`Должность «${dialog.position.name}» будет удалена и снята с сотрудников, которые её занимают.`}
          confirmLabel="Удалить"
          pending={deletePosition.isPending}
          onConfirm={() => deletePosition.mutate(dialog.position.id)}
          onClose={onClose}
        />
      );
  }
}
