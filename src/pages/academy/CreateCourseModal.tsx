import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { academyCoursesApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { academyRoutes } from '@/lib/academy';
import { toast } from '@/stores/toast';

export function CreateCourseModal({
  open,
  onClose,
  ownerType = 'company',
}: {
  open: boolean;
  onClose: () => void;
  ownerType?: 'company' | 'partner';
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () =>
      academyCoursesApi.create(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          ownerType,
          sequential: true,
          visibility: 'restricted',
        },
        { idempotencyKey: crypto.randomUUID() },
      ),
    onSuccess: (course) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.courses() });
      toast.success('Курс создан');
      onClose();
      setTitle('');
      setDescription('');
      navigate(academyRoutes.builder(course.id));
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось создать курс'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Создать курс"
      description={
        ownerType === 'partner'
          ? 'Собственный курс партнёра. Публикация создаст immutable version.'
          : 'Курс компании. После создания откроется конструктор draft.'
      }
    >
      <div className="space-y-4">
        <Input
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например, Онбординг менеджера"
          autoFocus
        />
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Краткое описание (необязательно)"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            loading={create.isPending}
            disabled={!title.trim()}
            onClick={() => create.mutate()}
          >
            Создать и открыть конструктор
          </Button>
        </div>
      </div>
    </Modal>
  );
}
