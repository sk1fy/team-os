import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '@/api';
import { toast } from '@/stores/toast';
import { Button, Input, Modal, Textarea } from '@/components/ui';
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
  withDescription?: boolean;
  pending: boolean;
  onSubmit: (values: { name: string; description: string }) => void;
  onClose: () => void;
}

function FormModal({
  title,
  submitLabel,
  initialName = '',
  initialDescription = '',
  withDescription = false,
  pending,
  onSubmit,
  onClose,
}: FormModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSubmit({ name: name.trim(), description: description.trim() });
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
          withDescription
          pending={createPosition.isPending}
          onSubmit={({ name, description }) =>
            createPosition.mutate({ name, description, departmentId: dialog.departmentId })
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
          withDescription
          pending={updatePosition.isPending}
          onSubmit={({ name, description }) =>
            updatePosition.mutate({ id: dialog.position.id, name, description })
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
