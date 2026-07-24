import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FilePlus2, LayoutTemplate } from 'lucide-react';
import { academyCoursesApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { academyRoutes } from '@/lib/academy';
import { createId } from '@/lib/id';
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
  const [mode, setMode] = useState<'blank' | 'template' | 'kb'>('blank');
  const createIdempotencyKey = useRef<string | null>(null);

  const resetAndClose = () => {
    createIdempotencyKey.current = null;
    setMode('blank');
    setTitle('');
    setDescription('');
    onClose();
  };

  const create = useMutation({
    mutationFn: async () => {
      const idempotencyKey = createIdempotencyKey.current ?? createId();
      createIdempotencyKey.current = idempotencyKey;
      // Server sets company vs partner owner from role — do not send ownerType.
      const course = await academyCoursesApi.create(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          sequential: true,
          visibility: 'restricted',
        },
        { idempotencyKey },
      );
      return course;
    },
    onSuccess: (course) => {
      createIdempotencyKey.current = null;
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      toast.success('Курс создан');
      resetAndClose();
      navigate(academyRoutes.builder(course.id));
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось создать курс'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && resetAndClose()}
      title="Создать курс"
      description={
        ownerType === 'partner'
          ? 'Собственный курс партнёра. Публикация создаст immutable version.'
          : 'Курс компании. После создания откроется конструктор draft.'
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Способ создания</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              aria-pressed={mode === 'blank'}
              onClick={() => setMode('blank')}
              className={
                mode === 'blank'
                  ? 'rounded-lg border border-primary-500 bg-primary-50 p-3 text-left outline-none ring-1 ring-primary-500'
                  : 'rounded-lg border border-slate-200 bg-surface p-3 text-left hover:border-primary-300'
              }
            >
              <FilePlus2 className="mb-2 size-5 text-primary-600" />
              <span className="block text-sm font-semibold text-slate-900">С нуля</span>
              <span className="mt-1 block text-xs text-slate-500">Пустой draft в конструкторе</span>
            </button>
            <button
              type="button"
              aria-pressed={mode === 'template'}
              onClick={() => setMode('template')}
              className={
                mode === 'template'
                  ? 'rounded-lg border border-primary-500 bg-primary-50 p-3 text-left outline-none ring-1 ring-primary-500'
                  : 'rounded-lg border border-slate-200 bg-surface p-3 text-left hover:border-primary-300'
              }
            >
              <LayoutTemplate className="mb-2 size-5 text-primary-600" />
              <span className="block text-sm font-semibold text-slate-900">Из шаблона</span>
              <span className="mt-1 block text-xs text-slate-500">
                Выбрать опубликованный шаблон
              </span>
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Будет доступно после появления KB import API"
              className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 p-3 text-left opacity-60"
            >
              <BookOpen className="mb-2 size-5 text-slate-500" />
              <span className="block text-sm font-semibold text-slate-700">Из базы знаний</span>
              <span className="mt-1 block text-xs text-slate-500">
                Ожидает backend KB import API
              </span>
            </button>
          </div>
        </div>

        {mode === 'blank' ? (
          <>
            <Input
              label="Название"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например, Онбординг менеджера"
              autoFocus
            />
            <Textarea
              label="Описание"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание (необязательно)"
            />
          </>
        ) : (
          <p className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-800">
            Выберите шаблон в галерее: создание курса выполняется только из опубликованной версии
            шаблона.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={resetAndClose}>
            Отмена
          </Button>
          {mode === 'template' ? (
            <Button
              onClick={() => {
                resetAndClose();
                navigate(academyRoutes.templates);
              }}
            >
              Перейти к шаблонам
            </Button>
          ) : (
            <Button
              loading={create.isPending}
              disabled={!title.trim()}
              onClick={() => create.mutate()}
            >
              Создать и открыть конструктор
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
