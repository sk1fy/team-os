import { queryKeys } from '@/api/queryKeys';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, FileWarning } from 'lucide-react';
import { kbApi } from '@/api';
import { Badge, RichTextView } from '@/components/ui';
import { formatDate } from '@/lib/format';

export function ShareArticlePage() {
  const { articleId = '' } = useParams();
  const articleQuery = useQuery({
    queryKey: queryKeys.kb.article(articleId),
    queryFn: () => kbApi.getPublicArticle(articleId),
    enabled: Boolean(articleId),
  });

  const article = articleQuery.data;
  const unavailable = articleQuery.isError || (article && article.status !== 'published');

  useTitle(
    article && article.status === 'published' ? `${article.title} — TeamOS` : 'Статья — TeamOS',
  );

  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="border-b border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link
            to="/knowledge"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"
          >
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
          </article>
        )}
      </main>
    </div>
  );
}
