/**
 * Очередь ручной проверки открытых ответов.
 *
 * В базовой Академии колонка «Проверка» показывает флаг pendingReview, но
 * самого интерфейса проверки нет — попытка зависает навсегда. Здесь
 * проверяющий видит ответы, выносит вердикт по каждому открытому вопросу,
 * и балл пересчитывается на стороне API.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { academyOpusApi } from '@/api/academyOpus';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/client';
import type { ID, Quiz, User } from '@/types';
import type { ReviewQueueItem } from '@/types/academyOpus';
import { Button, Textarea } from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { formatRelativeDate } from '@/lib/format';
import { toast } from '@/stores/toast';
import { fullName } from './labels';

export function ReviewTab({ users, quizzes }: { users: User[]; quizzes: Quiz[] }) {
  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    queryKey: queryKeys.academyOpus.reviewQueue,
    queryFn: academyOpusApi.getReviewQueue,
  });

  const review = useMutation({
    mutationFn: academyOpusApi.reviewAttempt,
    onSuccess: (attempt) => {
      toast.success(
        attempt.passed ? `Зачтено — итоговый балл ${attempt.score}%` : 'Отклонено, тест не сдан',
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyOpus.all });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось сохранить проверку'),
  });

  if (queueQuery.isError) return <ErrorState onRetry={() => void queueQuery.refetch()} />;

  if (queueQuery.isPending) {
    return <div className="h-48 animate-pulse rounded-lg bg-slate-200/60" />;
  }

  const queue = queueQuery.data ?? [];

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Очередь пуста"
        description="Открытые ответы появятся здесь, как только кто-то сдаст тест с развёрнутым вопросом."
      />
    );
  }

  return (
    <div className="space-y-4">
      {queue.map((item) => (
        <ReviewCard
          key={item.detail.attemptId}
          item={item}
          user={users.find((user) => user.id === item.userId)}
          quiz={quizzes.find((quiz) => quiz.id === item.detail.quizId)}
          onSubmit={(openReview, comment) =>
            review.mutate({ attemptId: item.detail.attemptId, openReview, comment })
          }
          submitting={review.isPending}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  item,
  user,
  quiz,
  onSubmit,
  submitting,
}: {
  item: ReviewQueueItem;
  user: User | undefined;
  quiz: Quiz | undefined;
  onSubmit: (openReview: Record<ID, boolean>, comment?: string) => void;
  submitting: boolean;
}) {
  const [verdicts, setVerdicts] = useState<Record<ID, boolean>>({});
  const [comment, setComment] = useState('');

  const openQuestions = (quiz?.questions ?? []).filter((question) => question.type === 'open');
  const allDecided = openQuestions.every((question) => question.id in verdicts);

  return (
    <article className="rounded-lg border border-slate-200 bg-surface p-5 shadow-card">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-950">{fullName(user)}</h3>
          <p className="text-sm text-slate-500">
            {item.courseTitle} · {item.lessonTitle} · отправлено{' '}
            {formatRelativeDate(item.detail.createdAt)}
          </p>
        </div>
      </header>

      <div className="space-y-4">
        {openQuestions.map((question) => {
          const answer = item.detail.answers.find(
            (entry) => entry.questionId === question.id,
          )?.text;
          const verdict = verdicts[question.id];

          return (
            <div key={question.id} className="rounded-md border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">{question.text}</p>
              <p className="mt-2 rounded bg-surface-muted p-3 text-sm whitespace-pre-wrap text-slate-700">
                {answer?.trim() || <span className="text-slate-400">Ответ не заполнен</span>}
              </p>

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant={verdict === true ? 'primary' : 'secondary'}
                  onClick={() => setVerdicts((current) => ({ ...current, [question.id]: true }))}
                >
                  <Check className="size-4" />
                  Зачесть
                </Button>
                <Button
                  size="sm"
                  variant={verdict === false ? 'danger' : 'secondary'}
                  onClick={() => setVerdicts((current) => ({ ...current, [question.id]: false }))}
                >
                  <X className="size-4" />
                  Не зачесть
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Textarea
        rows={2}
        className="mt-4"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Комментарий сотруднику (необязательно)"
      />

      <div className="mt-3 flex justify-end">
        <Button
          onClick={() => onSubmit(verdicts, comment.trim() || undefined)}
          disabled={!allDecided}
          loading={submitting}
        >
          Сохранить проверку
        </Button>
      </div>
    </article>
  );
}
