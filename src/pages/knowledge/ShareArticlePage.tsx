import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Check, ChevronLeft, FileWarning } from 'lucide-react';
import { kbApi } from '@/api';
import { Badge, Button, RichTextView } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { toast } from '@/stores/toast';

export function ShareArticlePage() {
  const { articleId = '' } = useParams();
  const queryClient = useQueryClient();

  const articleQuery = useQuery({
    queryKey: ['kb', 'article', articleId],
    queryFn: () => kbApi.getArticle(articleId),
    enabled: Boolean(articleId),
  });
  const acknowledgementsQuery = useQuery({
    queryKey: ['kb', 'acknowledgements', articleId],
    queryFn: () => kbApi.getAcknowledgements(articleId),
    enabled: Boolean(articleId),
  });

  const article = articleQuery.data;
  const unavailable = articleQuery.isError || (article && article.status !== 'published');
  const acknowledgedUserIds = new Set((acknowledgementsQuery.data ?? []).map((item) => item.userId));
  // Мок пишет ознакомление на CURRENT_USER_ID ('user-1'); реальный бэкенд определит сотрудника по ссылке/сессии.
  const currentUserAcknowledged = acknowledgedUserIds.has('user-1');

  useTitle(article && article.status === 'published' ? `${article.title} — TeamOS` : 'Статья — TeamOS');

  const acknowledge = useMutation({
    mutationFn: kbApi.acknowledgeArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb', 'acknowledgements'] });
      toast.success('Отметка сохранена');
    },
    onError: () => toast.error('Не удалось сохранить отметку'),
  });

  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="border-b border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/knowledge" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <ChevronLeft className="size-4" />
            TeamOS
          </Link>
          {article?.status === 'published' && <Badge variant="success">Статья</Badge>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {articleQuery.isPending ? (
          <div className="rounded-lg border border-slate-200 bg-surface p-6 shadow-card">
            <div className="mb-4 h-4 w-28 rounded bg-slate-100" />
            <div className="mb-6 h-8 w-3/4 rounded bg-slate-100" />
            <div className="space-y-3">
              <div className="h-4 rounded bg-slate-100" />
              <div className="h-4 w-11/12 rounded bg-slate-100" />
              <div className="h-4 w-4/5 rounded bg-slate-100" />
            </div>
          </div>
        ) : unavailable || !article ? (
          <div className="rounded-lg border border-slate-200 bg-surface p-6 text-center shadow-card">
            <FileWarning className="mx-auto mb-3 size-9 text-slate-300" />
            <h1 className="text-lg font-semibold text-slate-950">Статья недоступна</h1>
            <p className="mt-2 text-sm text-slate-500">
              Возможно, ссылка устарела или статья ещё не опубликована.
            </p>
          </div>
        ) : (
          <article className="rounded-lg border border-slate-200 bg-surface p-6 shadow-card">
            <div className="mb-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="neutral">Версия {article.version}</Badge>
                <Badge variant="neutral">Обновлено {formatDate(article.updatedAt)}</Badge>
                {article.requiresAcknowledgement && <Badge variant="primary">Ознакомление</Badge>}
              </div>
              <h1>{article.title}</h1>
            </div>

            <RichTextView content={article.content} />

            {article.requiresAcknowledgement && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-primary-900">
                  {currentUserAcknowledged ? (
                    <Check className="size-4 text-success-600" />
                  ) : (
                    <BookOpen className="size-4" />
                  )}
                  {currentUserAcknowledged
                    ? 'Ознакомление подтверждено.'
                    : 'Подтвердите, что вы ознакомились со статьёй.'}
                </div>
                <Button
                  size="sm"
                  disabled={currentUserAcknowledged}
                  loading={acknowledge.isPending}
                  onClick={() => acknowledge.mutate(article.id)}
                >
                  <Check className="size-4" />
                  Ознакомлен
                </Button>
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
