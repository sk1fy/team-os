import { useEffect, useState, type FormEvent } from 'react';
import type { DealDistributionGroup, User } from '@/types';
import { fullName } from '@/lib/labels';
import { plural } from '@/lib/format';
import { Button, Input, Modal, MultiSelect, Textarea } from '@/components/ui';

export interface DistributionGroupValues {
  name: string;
  description: string;
  memberIds: string[];
}

export function DistributionGroupModal({
  open,
  group,
  users,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  group?: DealDistributionGroup;
  users: User[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: DistributionGroupValues) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setDescription(group?.description ?? '');
    setMemberIds(group?.memberIds ?? []);
  }, [open, group]);

  const employeeOptions = users
    .filter((user) => user.status === 'active' && user.role !== 'partner')
    .sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'))
    .map((user) => ({ value: user.id, label: fullName(user) }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || memberIds.length === 0) return;
    onSubmit({ name: name.trim(), description: description.trim(), memberIds });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={group ? 'Настройки группы' : 'Новая группа распределения'}
      description="Объедините сотрудников, между которыми будут распределяться новые сделки."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="distribution-group-form"
            loading={pending}
            disabled={!name.trim() || memberIds.length === 0}
          >
            {group ? 'Сохранить' : 'Создать группу'}
          </Button>
        </>
      }
    >
      <form id="distribution-group-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Название группы"
          placeholder="Например, Входящие заявки — Отдел продаж"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          required
        />
        <Textarea
          label="Описание"
          placeholder="Какие сделки и как распределяются…"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Сотрудники</p>
          <MultiSelect
            options={employeeOptions}
            values={memberIds}
            onValuesChange={setMemberIds}
            placeholder="Выберите сотрудников"
            formatCount={(count) =>
              `${count} ${plural(count, ['сотрудник', 'сотрудника', 'сотрудников'])}`
            }
          />
          <p className="text-xs text-slate-500">
            Порядок очереди можно будет увидеть внутри группы.
          </p>
        </div>
      </form>
    </Modal>
  );
}
