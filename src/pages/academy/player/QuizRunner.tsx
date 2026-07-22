import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { Button, Checkbox, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import type {
  QuizAttemptAnswer,
  QuizAttemptResult,
  QuizLearner,
  QuizQuestionLearner,
} from '@/types/academy';

export type QuizDraftAnswers = Record<string, { optionIds: string[]; openText: string }>;

export function emptyQuizDraft(quiz: QuizLearner): QuizDraftAnswers {
  const draft: QuizDraftAnswers = {};
  for (const q of quiz.questions) {
    draft[q.id] = { optionIds: [], openText: '' };
  }
  return draft;
}

export function draftToAnswers(draft: QuizDraftAnswers): QuizAttemptAnswer[] {
  return Object.entries(draft).map(([questionId, value]) => ({
    questionId,
    selectedOptionIds: value.optionIds.length > 0 ? value.optionIds : undefined,
    openText: value.openText.trim() ? value.openText : undefined,
  }));
}

export function isQuizDraftComplete(quiz: QuizLearner, draft: QuizDraftAnswers): boolean {
  return quiz.questions.every((q) => {
    const answer = draft[q.id];
    if (!answer) return false;
    if (q.type === 'open') return answer.openText.trim().length > 0;
    if (q.type === 'single') return answer.optionIds.length === 1;
    return answer.optionIds.length >= 1;
  });
}

export function QuizRunner({
  quiz,
  disabled,
  submitting,
  lastResult,
  onSubmit,
  onRetry,
}: {
  quiz: QuizLearner;
  disabled?: boolean;
  submitting?: boolean;
  lastResult?: QuizAttemptResult | null;
  onSubmit: (answers: QuizAttemptAnswer[]) => void;
  onRetry?: () => void;
}) {
  const [draft, setDraft] = useState<QuizDraftAnswers>(() => emptyQuizDraft(quiz));
  const summaryRef = useRef<HTMLDivElement>(null);
  const summaryId = useId();

  useEffect(() => {
    setDraft(emptyQuizDraft(quiz));
    // Reset answers only when quiz identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: quiz.id
  }, [quiz.id]);

  useEffect(() => {
    if (lastResult && summaryRef.current) {
      summaryRef.current.focus();
    }
    // Focus summary when a new attempt arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: lastResult?.attemptId
  }, [lastResult?.attemptId]);

  const complete = useMemo(() => isQuizDraftComplete(quiz, draft), [quiz, draft]);
  const showResult = Boolean(lastResult);
  const canRetry =
    lastResult &&
    !lastResult.passed &&
    !lastResult.pendingReview &&
    (lastResult.maxAttempts == null || lastResult.attemptsUsed < lastResult.maxAttempts);

  const toggleOption = (question: QuizQuestionLearner, optionId: string) => {
    if (disabled || showResult) return;
    setDraft((prev) => {
      const current = prev[question.id] ?? { optionIds: [], openText: '' };
      if (question.type === 'single') {
        return { ...prev, [question.id]: { ...current, optionIds: [optionId] } };
      }
      const has = current.optionIds.includes(optionId);
      return {
        ...prev,
        [question.id]: {
          ...current,
          optionIds: has
            ? current.optionIds.filter((id) => id !== optionId)
            : [...current.optionIds, optionId],
        },
      };
    });
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6 border-t border-slate-200 p-4 sm:p-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Проверка знаний</h3>
        <p className="mt-1 text-sm text-slate-500">
          Проходной балл {quiz.passingScore}%
          {quiz.maxAttempts != null
            ? ` · попыток: ${quiz.attemptsUsed ?? 0}/${quiz.maxAttempts}`
            : null}
        </p>
      </div>

      {lastResult ? (
        <div
          ref={summaryRef}
          id={summaryId}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={cn(
            'rounded-xl border px-4 py-3 outline-none',
            lastResult.passed
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : lastResult.pendingReview
                ? 'border-amber-200 bg-amber-50 text-amber-950'
                : 'border-red-200 bg-red-50 text-red-950',
          )}
        >
          <div className="flex items-start gap-2">
            {lastResult.passed ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {lastResult.passed
                  ? 'Тест пройден'
                  : lastResult.pendingReview
                    ? 'Ответы на проверке'
                    : 'Тест не пройден'}
              </p>
              <p className="mt-1 text-sm opacity-90">
                Результат: {lastResult.score}%
                {lastResult.pendingReview
                  ? '. Открытые ответы ждут проверки — урок нельзя завершить до решения.'
                  : lastResult.passed
                    ? '. Можно завершить урок и продолжить.'
                    : canRetry
                      ? `. Осталось попыток: ${
                          lastResult.maxAttempts == null
                            ? 'без ограничений'
                            : lastResult.maxAttempts - lastResult.attemptsUsed
                        }.`
                      : '. Попытки исчерпаны.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <ol className="space-y-6">
        {quiz.questions.map((question, index) => {
          const feedback = lastResult?.feedback.find((f) => f.questionId === question.id);
          const answer = draft[question.id] ?? { optionIds: [], openText: '' };
          return (
            <li key={question.id} className="rounded-xl border border-slate-200 bg-surface p-4">
              <p className="text-sm font-semibold text-slate-900">
                {index + 1}. {question.text}
              </p>
              {question.type === 'open' ? (
                <Textarea
                  className="mt-3"
                  value={answer.openText}
                  disabled={disabled || showResult}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [question.id]: {
                        ...(prev[question.id] ?? { optionIds: [], openText: '' }),
                        openText: e.target.value,
                      },
                    }))
                  }
                  placeholder="Ваш ответ…"
                  rows={3}
                />
              ) : (
                <ul className="mt-3 space-y-2">
                  {question.options.map((option) => {
                    const checked = answer.optionIds.includes(option.id);
                    const isCorrectOption = feedback?.correctOptionIds?.includes(option.id);
                    const isWrongSelected =
                      feedback && !feedback.correct && feedback.selectedOptionIds?.includes(option.id);
                    return (
                      <li key={option.id}>
                        <div
                          className={cn(
                            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                            checked && !feedback && 'border-primary-300 bg-primary-50',
                            isCorrectOption && 'border-emerald-300 bg-emerald-50',
                            isWrongSelected && 'border-red-300 bg-red-50',
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled || showResult}
                            onCheckedChange={() => toggleOption(question, option.id)}
                            label={option.text}
                            className="w-full"
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {feedback?.explanation ? (
                <p className="mt-3 text-sm text-slate-600">{feedback.explanation}</p>
              ) : null}
              {feedback ? (
                <p
                  className={cn(
                    'mt-2 text-xs font-medium',
                    feedback.correct ? 'text-emerald-700' : 'text-red-700',
                  )}
                >
                  {feedback.correct ? 'Верно' : 'Неверно'}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        {!showResult ? (
          <Button
            disabled={disabled || submitting || !complete}
            loading={submitting}
            onClick={() => onSubmit(draftToAnswers(draft))}
          >
            Проверить ответы
          </Button>
        ) : canRetry ? (
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(emptyQuizDraft(quiz));
              onRetry?.();
            }}
          >
            <RotateCcw className="size-4" />
            Попробовать ещё раз
          </Button>
        ) : null}
      </div>
    </section>
  );
}
