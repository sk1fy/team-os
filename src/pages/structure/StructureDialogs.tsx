import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '@/api';
import type { Position } from '@/types';
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
  initialLevel?: Position['level'];
  withLevel?: boolean;
  withDescription?: boolean;
  pending: boolean;
  onSubmit: (values: {
    name: string;
    description: string;
    level: Position['level'];
  }) => void;
  onClose: () => void;
}

const positionLevelOptions = [
  { value: '4', label: 'Уровень 4 — верхний' },
  { value: '3', label: 'Уровень 3' },
  { value: '2', label: 'Уровень 2' },
  { value: '1', label: 'Уровень 1' },
  { value: '0', label: 'Уровень 0 — нижний' },
];

function FormModal({
  title,
  submitLabel,
  initialName = '',
  initialDescription = '',
  initialLevel = 0,
  withLevel = false,
  withDescription = false,
  pending,
  onSubmit,
  onClose,
}: FormModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [level, setLevel] = useState(String(initialLevel));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) {
      onSubmit({
        name: name.trim(),
        description: description.trim(),
        level: Number(level) as Position['level'],
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
          <Button type="submit" form="structure-form" loading={pending} disabled={!name.trim()}>
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
        {withLevel && (
          <Select
            label="Уровень должности"
            value={level}
            onValueChange={setLevel}
            options={positionLevelOptions}
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

function ConfirmModal({ title, text, confirmLabel, pending, onConfirm, onClose }: ConfirmModalProps) {
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
  const renameDepartment = useMutation({
    mutationFn: orgApi.renameDepartment,
    onSuccess: () => done('departments', 'Отдел переименован'),
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
          pending={createDepartment.isPending}
          onSubmit={({ name }) => createDepartment.mutate({ name, parentId: dialog.parentId })}
          onClose={onClose}
        />
      );
    case 'renameDepartment':
      return (
        <FormModal
          title="Переименовать отдел"
          submitLabel="Сохранить"
          initialName={dialog.department.name}
          pending={renameDepartment.isPending}
          onSubmit={({ name }) => renameDepartment.mutate({ id: dialog.department.id, name })}
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
          pending={createPosition.isPending}
          onSubmit={({ name, description, level }) =>
            createPosition.mutate({ name, description, level, departmentId: dialog.departmentId })
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
          withLevel
          withDescription
          pending={updatePosition.isPending}
          onSubmit={({ name, description, level }) =>
            updatePosition.mutate({ id: dialog.position.id, name, description, level })
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
