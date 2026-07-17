import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  FileClock,
  FileText,
  Folder,
  FolderPlus,
  History,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { kbApi, orgApi } from '@/api';
import type { AccessSettings, Article, ArticleSection, ID, RichTextContent } from '@/types';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { fullName } from '@/lib/labels';
import { copyText } from '@/lib/clipboard';
import { getRichTextHeadings, plainTextToRichText, richTextToPlainText } from '@/lib/richText';
import { toast } from '@/stores/toast';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Input,
  Modal,
  RichTextEditor,
  RichTextView,
  Select,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { cn } from '@/lib/cn';

const emptyDoc: RichTextContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const emptySections: ArticleSection[] = [];
const emptyArticles: Article[] = [];

const articleTemplates = [
  {
    value: 'policy',
    label: 'Регламент',
    content: plainTextToRichText(
      'Цель регламента\n\nКогда применять\n\nОтветственные\n\nПорядок действий\n\nКонтроль результата',
    ),
  },
  {
    value: 'instruction',
    label: 'Инструкция',
    content: plainTextToRichText('Перед началом\n\nШаг 1\n\nШаг 2\n\nШаг 3\n\nЧастые ошибки'),
  },
  {
    value: 'checklist',
    label: 'Чек-лист',
    content: plainTextToRichText(
      'Проверить вводные\n\nСогласовать ответственного\n\nЗафиксировать результат',
    ),
  },
];

function sectionChildren(sections: ArticleSection[], parentId: ID | null) {
  return sections
    .filter((section) => section.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

function SectionBranch({
  section,
  sections,
  articles,
  activeSectionId,
  activeArticleId,
  onSelectSection,
  onSelectArticle,
}: {
  section: ArticleSection;
  sections: ArticleSection[];
  articles: Article[];
  activeSectionId: ID | null;
  activeArticleId: ID | null;
  onSelectSection: (id: ID) => void;
  onSelectArticle: (id: ID) => void;
}) {
  const [open, setOpen] = useState(true);
  const children = sectionChildren(sections, section.id);
  const sectionArticles = articles
    .filter((article) => article.sectionId === section.id)
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={open ? 'Свернуть' : 'Развернуть'}
        >
          <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => onSelectSection(section.id)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
            activeSectionId === section.id && !activeArticleId
              ? 'bg-primary-50 text-primary-800'
              : 'text-slate-700 hover:bg-slate-100',
          )}
        >
          <Folder className="size-4 shrink-0 text-primary-500" />
          <span className="truncate">{section.name}</span>
        </button>
      </div>

      {open && (
        <div className="ml-5 space-y-1 border-l border-slate-100 pl-2">
          {sectionArticles.map((article) => (
            <button
              key={article.id}
              type="button"
              onClick={() => onSelectArticle(article.id)}
              className={cn(
                'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                activeArticleId === article.id
                  ? 'bg-primary-50 text-primary-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <FileText className="size-4 shrink-0 text-slate-400" />
              <span className="truncate">{article.title}</span>
            </button>
          ))}
          {children.map((child) => (
            <SectionBranch
              key={child.id}
              section={child}
              sections={sections}
              articles={articles}
              activeSectionId={activeSectionId}
              activeArticleId={activeArticleId}
              onSelectSection={onSelectSection}
              onSelectArticle={onSelectArticle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionDialog({
  open,
  mode,
  parentId,
  section,
  onClose,
}: {
  open: boolean;
  mode: 'create' | 'rename';
  parentId: ID | null;
  section?: ArticleSection;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName(section?.name ?? '');
  }, [open, section]);

  const createSection = useMutation({
    mutationFn: kbApi.createSection,
    onSuccess: (createdSection) => {
      queryClient.setQueryData<ArticleSection[]>(['kb', 'sections'], (current = []) => [
        ...current.filter((item) => item.id !== createdSection.id),
        createdSection,
      ]);
      void queryClient.invalidateQueries({ queryKey: ['kb', 'sections'] });
      toast.success('Раздел создан');
      onClose();
    },
  });

  const updateSection = useMutation({
    mutationFn: kbApi.updateSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb', 'sections'] });
      toast.success('Раздел обновлён');
      onClose();
    },
  });

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (mode === 'create') createSection.mutate({ name: trimmed, parentId });
    else if (section) updateSection.mutate({ id: section.id, name: trimmed });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={mode === 'create' ? 'Новый раздел' : 'Переименовать раздел'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={submit}
            disabled={!name.trim()}
            loading={createSection.isPending || updateSection.isPending}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <Input label="Название" value={name} onChange={(event) => setName(event.target.value)} />
    </Modal>
  );
}

function AccessDialog({
  section,
  open,
  onClose,
}: {
  section?: ArticleSection;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: orgApi.getDepartments });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const [access, setAccess] = useState<AccessSettings>({
    scope: 'company',
    departmentIds: [],
    positionIds: [],
    userIds: [],
  });

  useEffect(() => {
    if (open && section) setAccess(section.access);
  }, [open, section]);

  const updateSection = useMutation({
    mutationFn: kbApi.updateSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb', 'sections'] });
      toast.success('Доступ обновлён');
      onClose();
    },
  });

  const toggle = (key: 'departmentIds' | 'positionIds' | 'userIds', id: ID) => {
    setAccess((current) => {
      const values = new Set(current[key]);
      if (values.has(id)) values.delete(id);
      else values.add(id);
      return { ...current, scope: 'custom', [key]: [...values] };
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Доступ к разделу"
      description={section?.name}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            loading={updateSection.isPending}
            onClick={() => section && updateSection.mutate({ id: section.id, access })}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
          <input
            type="radio"
            checked={access.scope === 'company'}
            onChange={() =>
              setAccess({ scope: 'company', departmentIds: [], positionIds: [], userIds: [] })
            }
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">Вся компания</span>
            <span className="text-xs text-slate-500">Дочерние разделы наследуют этот доступ.</span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
          <input
            type="radio"
            checked={access.scope === 'custom'}
            onChange={() => setAccess((current) => ({ ...current, scope: 'custom' }))}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">Выборочно</span>
            <span className="text-xs text-slate-500">
              Отделы, должности и отдельные сотрудники.
            </span>
          </span>
        </label>

        {access.scope === 'custom' && (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Отделы
              </p>
              <div className="space-y-2">
                {(departmentsQuery.data ?? []).map((department) => (
                  <label key={department.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={access.departmentIds.includes(department.id)}
                      onChange={() => toggle('departmentIds', department.id)}
                    />
                    {department.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Должности
              </p>
              <div className="space-y-2">
                {(positionsQuery.data ?? []).map((position) => (
                  <label key={position.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={access.positionIds.includes(position.id)}
                      onChange={() => toggle('positionIds', position.id)}
                    />
                    {position.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Люди
              </p>
              <div className="space-y-2">
                {(usersQuery.data ?? []).map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={access.userIds.includes(user.id)}
                      onChange={() => toggle('userIds', user.id)}
                    />
                    {fullName(user)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ArticleDrawer({
  open,
  article,
  sectionId,
  sections,
  onClose,
  onCreateSection,
}: {
  open: boolean;
  article?: Article;
  sectionId: ID | null;
  sections: ArticleSection[];
  onClose: () => void;
  onCreateSection: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<ID>('');
  const [status, setStatus] = useState<Article['status']>('published');
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);
  const [content, setContent] = useState<RichTextContent>(emptyDoc);
  const [errors, setErrors] = useState<Partial<Record<'title' | 'section' | 'content', string>>>(
    {},
  );
  const titleRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const canSave = Boolean(title.trim() && selectedSectionId && richTextToPlainText(content).trim());

  useEffect(() => {
    if (!open) return;
    setTitle(article?.title ?? '');
    setSelectedSectionId(article?.sectionId ?? sectionId ?? sections[0]?.id ?? '');
    setStatus(article?.status ?? 'published');
    setRequiresAcknowledgement(article?.requiresAcknowledgement ?? false);
    setContent(article?.content ?? emptyDoc);
    setErrors({});
  }, [article, open, sectionId, sections]);

  const createArticle = useMutation({
    mutationFn: kbApi.createArticle,
    onSuccess: (createdArticle) => {
      queryClient.setQueryData<Article[]>(['kb', 'articles'], (current = []) => [
        ...current.filter((item) => item.id !== createdArticle.id),
        createdArticle,
      ]);
      void queryClient.invalidateQueries({ queryKey: ['kb', 'articles'] });
      toast.success('Статья создана');
      onClose();
    },
  });

  const updateArticle = useMutation({
    mutationFn: kbApi.updateArticle,
    onSuccess: (updatedArticle) => {
      queryClient.setQueryData<Article[]>(['kb', 'articles'], (current = []) =>
        current.map((item) => (item.id === updatedArticle.id ? updatedArticle : item)),
      );
      void queryClient.invalidateQueries({ queryKey: ['kb', 'articles'] });
      void queryClient.invalidateQueries({ queryKey: ['kb', 'versions'] });
      toast.success('Статья сохранена');
      onClose();
    },
  });

  const save = () => {
    const trimmed = title.trim();
    const nextErrors: typeof errors = {};
    if (!trimmed) nextErrors.title = 'Укажите название статьи';
    if (!selectedSectionId) nextErrors.section = 'Сначала создайте и выберите раздел';
    if (!richTextToPlainText(content).trim()) nextErrors.content = 'Добавьте содержание статьи';
    setErrors(nextErrors);
    if (nextErrors.title) titleRef.current?.focus();
    else if (nextErrors.section) sectionRef.current?.focus();
    else if (nextErrors.content) {
      editorRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
    }
    if (Object.keys(nextErrors).length > 0) return;
    if (article) {
      updateArticle.mutate({
        id: article.id,
        title: trimmed,
        sectionId: selectedSectionId,
        status,
        requiresAcknowledgement,
        content,
      });
    } else {
      createArticle.mutate({
        title: trimmed,
        sectionId: selectedSectionId,
        status,
        requiresAcknowledgement,
        content,
      });
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={article ? 'Редактировать статью' : 'Новая статья'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={save}
            disabled={!canSave}
            loading={createArticle.isPending || updateArticle.isPending}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          ref={titleRef}
          label="Название"
          value={title}
          error={errors.title}
          onChange={(event) => {
            setTitle(event.target.value);
            setErrors((current) => ({ ...current, title: undefined }));
          }}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Раздел"
            triggerRef={sectionRef}
            disabled={sections.length === 0}
            value={selectedSectionId}
            onValueChange={(value) => {
              setSelectedSectionId(value);
              setErrors((current) => ({ ...current, section: undefined }));
            }}
            error={errors.section}
            options={sections.map((section) => ({ value: section.id, label: section.name }))}
          />
          <Select
            label="Статус"
            value={status}
            onValueChange={(value) => setStatus(value as Article['status'])}
            options={[
              { value: 'published', label: 'Опубликована' },
              { value: 'draft', label: 'Черновик' },
            ]}
          />
        </div>
        {sections.length === 0 && (
          <div className="rounded-md border border-primary-200 bg-primary-50 p-3">
            <p className="text-sm font-medium text-primary-900">Сначала создайте раздел</p>
            <p className="mt-1 text-xs text-primary-700">
              Каждая статья должна находиться в разделе базы знаний.
            </p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={onCreateSection}>
              <FolderPlus className="size-4" />
              Создать раздел
            </Button>
          </div>
        )}
        <Select
          label="Шаблон"
          placeholder="Вставить шаблон"
          onValueChange={(value) => {
            const template = articleTemplates.find((item) => item.value === value);
            if (template) setContent(template.content);
          }}
          options={articleTemplates}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={requiresAcknowledgement}
            onChange={(event) => setRequiresAcknowledgement(event.target.checked)}
          />
          Требуется отметка ознакомления
        </label>
        <div ref={editorRef}>
          <RichTextEditor
            label="Содержание статьи"
            value={content}
            onChange={(value) => {
              setContent(value);
              setErrors((current) => ({ ...current, content: undefined }));
            }}
            minHeight={420}
          />
        </div>
        {errors.content && (
          <p role="alert" className="text-xs text-danger-600">
            {errors.content}
          </p>
        )}
      </div>
    </Drawer>
  );
}

function VersionsDialog({
  article,
  open,
  onClose,
}: {
  article?: Article;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    queryKey: ['kb', 'versions', article?.id],
    queryFn: () => kbApi.getArticleVersions(article!.id),
    enabled: open && Boolean(article),
  });
  const [selectedVersionId, setSelectedVersionId] = useState<ID | null>(null);
  const selectedVersion = versionsQuery.data?.find((version) => version.id === selectedVersionId);

  const rollback = useMutation({
    mutationFn: kbApi.rollbackArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb', 'articles'] });
      queryClient.invalidateQueries({ queryKey: ['kb', 'versions'] });
      toast.success('Версия восстановлена');
      onClose();
    },
  });

  useEffect(() => {
    if (versionsQuery.data?.[0]) setSelectedVersionId(versionsQuery.data[0].id);
  }, [versionsQuery.data]);

  return (
    <Modal open={open} onOpenChange={(next) => !next && onClose()} title="История версий" size="lg">
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {(versionsQuery.data ?? []).map((version) => (
            <button
              key={version.id}
              type="button"
              onClick={() => setSelectedVersionId(version.id)}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                selectedVersionId === version.id
                  ? 'border-primary-200 bg-primary-50 text-primary-800'
                  : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <span className="block font-medium">Версия {version.version}</span>
              <span className="text-xs text-slate-500">{formatDate(version.createdAt)}</span>
            </button>
          ))}
          {versionsQuery.isSuccess && versionsQuery.data.length === 0 && (
            <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
              Старых версий пока нет.
            </p>
          )}
        </div>
        <div className="min-h-80 rounded-md border border-slate-200 p-4">
          {selectedVersion ? (
            <>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3>{selectedVersion.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">Версия {selectedVersion.version}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={rollback.isPending}
                  onClick={() =>
                    article &&
                    rollback.mutate({ articleId: article.id, versionId: selectedVersion.id })
                  }
                >
                  Восстановить
                </Button>
              </div>
              <RichTextView content={selectedVersion.content} />
            </>
          ) : (
            <p className="text-sm text-slate-500">Выберите версию.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function KnowledgePage() {
  useTitle('База знаний — TeamOS');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSectionId, setActiveSectionId] = useState<ID | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<ID | null>(null);
  const [search, setSearch] = useState('');
  const [sectionDialog, setSectionDialog] = useState<'create' | 'rename' | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [articleDrawer, setArticleDrawer] = useState<'create' | 'edit' | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const sectionsQuery = useQuery({ queryKey: ['kb', 'sections'], queryFn: kbApi.getSections });
  const articlesQuery = useQuery({
    queryKey: ['kb', 'articles'],
    queryFn: () => kbApi.getArticles(),
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const acknowledgementsQuery = useQuery({
    queryKey: ['kb', 'acknowledgements', activeArticleId],
    queryFn: () => kbApi.getAcknowledgements(activeArticleId!),
    enabled: Boolean(activeArticleId),
  });

  const sections = sectionsQuery.data ?? emptySections;
  const articles = articlesQuery.data ?? emptyArticles;
  const activeSection = sections.find((section) => section.id === activeSectionId);
  const activeArticle = articles.find((article) => article.id === activeArticleId);
  const rootSections = sectionChildren(sections, null);
  const headings = getRichTextHeadings(activeArticle?.content);
  const requestedArticleId = searchParams.get('article');
  const isKnowledgeLoading = sectionsQuery.isPending || articlesQuery.isPending;

  useEffect(() => {
    if (!requestedArticleId) return;

    const article = articles.find((item) => item.id === requestedArticleId);
    if (!article) return;

    if (activeArticleId !== article.id) setActiveArticleId(article.id);
    if (activeSectionId !== article.sectionId) setActiveSectionId(article.sectionId);
  }, [activeArticleId, activeSectionId, articles, requestedArticleId]);

  useEffect(() => {
    if (requestedArticleId) return;
    if (!activeSectionId && sections[0]) setActiveSectionId(sections[0].id);
    if (!activeArticleId && articles[0]) setActiveArticleId(articles[0].id);
  }, [activeArticleId, activeSectionId, articles, requestedArticleId, sections]);

  const selectArticle = (id: ID) => {
    const article = articles.find((item) => item.id === id);
    setActiveArticleId(id);
    if (article) setActiveSectionId(article.sectionId);
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.set('article', id);
        return next;
      },
      { replace: true },
    );
  };

  const selectSection = (id: ID) => {
    setActiveSectionId(id);
    setActiveArticleId(null);
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete('article');
        return next;
      },
      { replace: true },
    );
  };

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return articles.filter((article) => {
      const body = richTextToPlainText(article.content).toLowerCase();
      return article.title.toLowerCase().includes(query) || body.includes(query);
    });
  }, [articles, search]);

  const deleteSection = useMutation({
    mutationFn: kbApi.deleteSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb', 'sections'] });
      toast.success('Раздел удалён');
      setActiveSectionId(null);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить раздел'),
  });

  const acknowledgedUserIds = new Set(
    (acknowledgementsQuery.data ?? []).map((item) => item.userId),
  );

  const copyArticleLink = async (articleId: ID) => {
    const copied = await copyText(`${window.location.origin}/share/article/${articleId}`);
    if (copied) toast.success('Ссылка скопирована');
    else toast.error('Не удалось скопировать ссылку');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 bg-surface px-6 py-5">
        <PageHeader
          title="База знаний"
          description="Разделы, регламенты, версии и подтверждение ознакомления."
          actions={
            <>
              <Button variant="secondary" onClick={() => setSectionDialog('create')}>
                <FolderPlus className="size-4" />
                Раздел
              </Button>
              <Button onClick={() => setArticleDrawer('create')}>
                <Plus className="size-4" />
                Статья
              </Button>
            </>
          }
        />
      </div>

      {isKnowledgeLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-slate-500">
          Загружаем базу знаний…
        </div>
      ) : sections.length === 0 && articles.length === 0 && !search.trim() ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            <EmptyState
              icon={FolderPlus}
              title="База знаний пока пуста"
              description="Создайте первый раздел, а затем добавьте в него регламенты, инструкции и другие материалы."
              action={
                <Button onClick={() => setSectionDialog('create')}>
                  <FolderPlus className="size-4" />
                  Создать раздел
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-surface">
            <div className="border-b border-slate-200 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Поиск по базе…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pl-9 pr-3 text-sm transition-colors focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {search.trim() ? (
                <div className="space-y-1">
                  {searchResults.map((article) => (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => {
                        selectArticle(article.id);
                      }}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <Search className="mt-0.5 size-4 shrink-0 text-slate-400" />
                      <span>
                        <span className="block font-medium text-slate-800">{article.title}</span>
                        <span className="line-clamp-2 text-xs text-slate-500">
                          {richTextToPlainText(article.content)}
                        </span>
                      </span>
                    </button>
                  ))}
                  {searchResults.length === 0 && (
                    <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                      Ничего не найдено.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {rootSections.map((section) => (
                    <SectionBranch
                      key={section.id}
                      section={section}
                      sections={sections}
                      articles={articles}
                      activeSectionId={activeSectionId}
                      activeArticleId={activeArticleId}
                      onSelectSection={selectSection}
                      onSelectArticle={selectArticle}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto">
            {activeArticle ? (
              <article className="mx-auto grid max-w-6xl gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0">
                  <div className="mb-5">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant={activeArticle.status === 'published' ? 'success' : 'warning'}
                        >
                          {activeArticle.status === 'published' ? 'Опубликована' : 'Черновик'}
                        </Badge>
                        <Badge variant="neutral">Версия {activeArticle.version}</Badge>
                        {activeArticle.requiresAcknowledgement && (
                          <Badge variant="primary">Ознакомление</Badge>
                        )}
                      </div>
                      <h1>{activeArticle.title}</h1>
                      <p className="mt-2 text-sm text-slate-500">
                        Обновлено {formatRelativeDate(activeArticle.updatedAt)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeArticle.status === 'published' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => copyArticleLink(activeArticle.id)}
                        >
                          <Share2 className="size-4" />
                          Поделиться
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => setVersionsOpen(true)}>
                        <History className="size-4" />
                        Версии
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setArticleDrawer('edit')}
                      >
                        <Pencil className="size-4" />
                        Изменить
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-surface p-6 shadow-card">
                    <RichTextView content={activeArticle.content} />
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FileClock className="size-4 text-slate-400" />
                      Оглавление
                    </div>
                    {headings.length > 0 ? (
                      <div className="space-y-2">
                        {headings.map((heading) => (
                          <div
                            key={heading.id}
                            className={cn('text-sm text-slate-600', heading.level > 2 && 'pl-3')}
                          >
                            {heading.text}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Заголовков пока нет.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <UsersRound className="size-4 text-slate-400" />
                      Ознакомились
                    </div>
                    <div className="space-y-3">
                      {(usersQuery.data ?? []).map((user) => (
                        <div key={user.id} className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar name={fullName(user)} src={user.avatarUrl} size="xs" />
                            <span className="truncate text-sm text-slate-700">
                              {fullName(user)}
                            </span>
                          </div>
                          <Badge variant={acknowledgedUserIds.has(user.id) ? 'success' : 'neutral'}>
                            {acknowledgedUserIds.has(user.id) ? 'Да' : 'Нет'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </article>
            ) : activeSection ? (
              <div className="mx-auto max-w-3xl p-6">
                <div className="rounded-lg border border-slate-200 bg-surface p-6 shadow-card">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Folder className="size-5 text-primary-500" />
                        <Badge
                          variant={activeSection.access.scope === 'company' ? 'success' : 'warning'}
                        >
                          {activeSection.access.scope === 'company' ? 'Вся компания' : 'Ограничен'}
                        </Badge>
                      </div>
                      <h1>{activeSection.name}</h1>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setAccessOpen(true)}>
                        <LockKeyhole className="size-4" />
                        Доступ
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSectionDialog('rename')}
                      >
                        <Pencil className="size-4" />
                        Название
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSection.mutate(activeSection.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    В разделе{' '}
                    {articles.filter((article) => article.sectionId === activeSection.id).length}{' '}
                    статей. Создайте новую статью или настройте доступ для команды.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-slate-500">
                Выберите раздел или статью.
              </div>
            )}
          </main>
        </div>
      )}

      <SectionDialog
        open={sectionDialog === 'create' || sectionDialog === 'rename'}
        mode={sectionDialog ?? 'create'}
        parentId={activeSectionId}
        section={activeSection}
        onClose={() => setSectionDialog(null)}
      />
      <AccessDialog
        section={activeSection}
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
      />
      <ArticleDrawer
        open={articleDrawer === 'create' || articleDrawer === 'edit'}
        article={articleDrawer === 'edit' ? activeArticle : undefined}
        sectionId={activeSectionId}
        sections={sections}
        onClose={() => setArticleDrawer(null)}
        onCreateSection={() => {
          setArticleDrawer(null);
          setSectionDialog('create');
        }}
      />
      <VersionsDialog
        article={activeArticle}
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
      />
    </div>
  );
}
