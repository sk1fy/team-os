import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FilePlus2, LayoutTemplate } from 'lucide-react';
import { academyCoursesApi } from '@/api/academy';
import { kbApi } from '@/api';
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
  const [kbImportMode, setKbImportMode] = useState<'link' | 'copy'>(
    ownerType === 'partner' ? 'copy' : 'link',
  );
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const createIdempotencyKey = useRef<string | null>(null);

  const resetAndClose = () => {
    createIdempotencyKey.current = null;
    setMode('blank');
    setKbImportMode(ownerType === 'partner' ? 'copy' : 'link');
    setSelectedArticleIds([]);
    setTitle('');
    setDescription('');
    onClose();
  };

  const create = useMutation({
    mutationFn: async () => {
      const idempotencyKey = createIdempotencyKey.current ?? createId();
      createIdempotencyKey.current = idempotencyKey;
      // Server sets company vs partner owner from role — do not send ownerType.
      const result = await academyCoursesApi.createDetailed(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          sequential: true,
          visibility: 'restricted',
        },
        { idempotencyKey },
      );
      return result;
    },
    onSuccess: ({ course, draft }) => {
      createIdempotencyKey.current = null;
      queryClient.setQueryData(queryKeys.academyV2.course(course.id), course);
      if (draft) {
        queryClient.setQueryData(queryKeys.academyV2.draft(course.id), draft);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      toast.success('Курс создан');
      resetAndClose();
      navigate(academyRoutes.builder(course.id));
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось создать курс'),
  });
  const sectionsQuery = useQuery({
    queryKey: queryKeys.kb.sections,
    queryFn: kbApi.getSections,
    enabled: open && mode === 'kb',
  });
  const articlesQuery = useQuery({
    queryKey: queryKeys.kb.articles,
    queryFn: () => kbApi.getArticles(),
    enabled: open && mode === 'kb',
  });
  const kbArticles = (articlesQuery.data ?? []).filter(
    (article) =>
      article.status === 'published' &&
      (ownerType !== 'partner' || article.partnerReusePolicy === 'copy_allowed'),
  );
  const sectionName = new Map(
    (sectionsQuery.data ?? []).map((section) => [section.id, section.name]),
  );
  const createFromKb = useMutation({
    mutationFn: () => {
      const selected = kbArticles.filter((article) => selectedArticleIds.includes(article.id));
      const idempotencyKey = createIdempotencyKey.current ?? createId();
      createIdempotencyKey.current = idempotencyKey;
      return academyCoursesApi.createFromKb(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          sequential: true,
          visibility: 'restricted',
          mode: ownerType === 'partner' ? 'copy' : kbImportMode,
          sectionIds: [...new Set(selected.map((article) => article.sectionId))],
          articleIds: selected.map((article) => article.id),
        },
        { idempotencyKey },
      );
    },
    onSuccess: (course) => {
      createIdempotencyKey.current = null;
      queryClient.setQueryData(queryKeys.academyV2.course(course.id), course);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      toast.success('Курс создан из базы знаний');
      resetAndClose();
      navigate(academyRoutes.builder(course.id));
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось импортировать статьи'),
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
              aria-pressed={mode === 'kb'}
              onClick={() => setMode('kb')}
              className={
                mode === 'kb'
                  ? 'rounded-lg border border-primary-500 bg-primary-50 p-3 text-left outline-none ring-1 ring-primary-500'
                  : 'rounded-lg border border-slate-200 bg-surface p-3 text-left hover:border-primary-300'
              }
            >
              <BookOpen className="mb-2 size-5 text-primary-600" />
              <span className="block text-sm font-semibold text-slate-900">Из базы знаний</span>
              <span className="mt-1 block text-xs text-slate-500">
                Выбрать опубликованные статьи
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
        ) : mode === 'template' ? (
          <p className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-800">
            Выберите шаблон в галерее: создание курса выполняется только из опубликованной версии
            шаблона.
          </p>
        ) : (
          <div className="space-y-4">
            <Input
              label="Название"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, Регламенты отдела продаж"
              autoFocus
            />
            <Textarea
              label="Описание"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Краткое описание (необязательно)"
            />
            {ownerType === 'company' ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">Режим статей</legend>
                <label className="flex gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="kb-import-mode"
                    checked={kbImportMode === 'link'}
                    onChange={() => setKbImportMode('link')}
                  />
                  Связать с актуальной версией статьи
                </label>
                <label className="flex gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="kb-import-mode"
                    checked={kbImportMode === 'copy'}
                    onChange={() => setKbImportMode('copy')}
                  />
                  Создать независимые копии
                </label>
              </fieldset>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Партнёрский курс получит независимые снимки только тех статей, для которых разрешено
                копирование.
              </p>
            )}
            <fieldset className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-sm font-medium text-slate-700">Статьи курса</legend>
              {sectionsQuery.isLoading || articlesQuery.isLoading ? (
                <p className="text-sm text-slate-500">Загружаем базу знаний…</p>
              ) : sectionsQuery.isError || articlesQuery.isError ? (
                <p className="text-sm text-danger-700">Не удалось загрузить статьи.</p>
              ) : kbArticles.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {ownerType === 'partner'
                    ? 'Нет опубликованных статей, разрешённых для копирования партнёром.'
                    : 'Нет опубликованных статей.'}
                </p>
              ) : (
                kbArticles.map((article) => (
                  <label
                    key={article.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-slate-50"
                  >
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={selectedArticleIds.includes(article.id)}
                      onChange={(event) =>
                        setSelectedArticleIds((current) =>
                          event.target.checked
                            ? [...current, article.id]
                            : current.filter((id) => id !== article.id),
                        )
                      }
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">
                        {article.title}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {sectionName.get(article.sectionId) ?? 'Раздел базы знаний'} · версия{' '}
                        {article.version}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </fieldset>
          </div>
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
          ) : mode === 'kb' ? (
            <Button
              loading={createFromKb.isPending}
              disabled={
                !title.trim() ||
                selectedArticleIds.length === 0 ||
                createFromKb.isPending ||
                articlesQuery.isError ||
                sectionsQuery.isError
              }
              onClick={() => createFromKb.mutate()}
            >
              Импортировать и открыть
            </Button>
          ) : (
            <Button
              loading={create.isPending}
              disabled={!title.trim() || create.isPending}
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
