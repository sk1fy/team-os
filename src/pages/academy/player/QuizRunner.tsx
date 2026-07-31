import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, CircleHelp, RotateCcw, XCircle } from 'lucide-react';
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
  onContinue,
  embedded,
  completed,
}: {
  quiz: QuizLearner;
  disabled?: boolean;
  submitting?: boolean;
  lastResult?: QuizAttemptResult | null;
  onSubmit: (answers: QuizAttemptAnswer[]) => void;
  onRetry?: () => void;
  onContinue?: () => void;
  embedded?: boolean;
  completed?: boolean;
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
  const answeredCount = useMemo(
    () =>
      quiz.questions.filter((question) => {
        const answer = draft[question.id];
        if (!answer) return false;
        return question.type === 'open'
          ? answer.openText.trim().length > 0
          : answer.optionIds.length > 0;
      }).length,
    [draft, quiz.questions],
  );
  const showResult = Boolean(lastResult);
  const maxAttempts = lastResult?.maxAttempts ?? quiz.maxAttempts;
  const attemptsUsed = lastResult?.attemptsUsed ?? quiz.attemptsUsed ?? 0;
  const canRetry =
    lastResult &&
    !lastResult.passed &&
    !lastResult.pendingReview &&
    (maxAttempts == null || attemptsUsed < maxAttempts);

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

  if (completed && !lastResult) {
    return (
      <section className={cn(!embedded && 'mx-auto max-w-4xl px-4 pb-10 sm:px-8')}>
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <h3 className="font-semibold">Тест пройден</h3>
            <p className="mt-1 text-sm text-emerald-800">
              Результат уже сохранён, повторно отвечать на вопросы не нужно.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn(!embedded && 'mx-auto max-w-4xl px-4 pb-10 sm:px-8')}>
      <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <CircleHelp className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700">
                Закрепите материал
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">Проверка знаний</h3>
              <p className="mt-1 text-sm text-slate-500">
                Для завершения урока нужно набрать {quiz.passingScore}%
              </p>
            </div>
          </div>
          <div className="min-w-36 rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
              <span>Отвечено</span>
              <span className="tabular-nums">
                {answeredCount} / {quiz.questions.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary-500 transition-[width] duration-200"
                style={{
                  width: `${quiz.questions.length ? (answeredCount / quiz.questions.length) * 100 : 0}%`,
                }}
              />
            </div>
            {maxAttempts != null ? (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Использовано попыток: {attemptsUsed} из {maxAttempts}
              </p>
            ) : null}
          </div>
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
                      ? onContinue
                        ? '. Результат сохранён. Можно перейти к следующему уроку.'
                        : '. Результат сохранён.'
                      : canRetry
                        ? `. Осталось попыток: ${
                            maxAttempts == null ? 'без ограничений' : maxAttempts - attemptsUsed
                          }.`
                        : '. Попытки исчерпаны.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <ol className="mt-6 space-y-4">
          {quiz.questions.map((question, index) => {
            const feedback = lastResult?.feedback.find((f) => f.questionId === question.id);
            const answer = draft[question.id] ?? { optionIds: [], openText: '' };
            return (
              <li
                key={question.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      feedback?.correct
                        ? 'bg-emerald-100 text-emerald-700'
                        : feedback
                          ? 'bg-red-100 text-red-700'
                          : answer.openText.trim() || answer.optionIds.length
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {feedback?.correct ? <Check className="size-4" aria-hidden /> : index + 1}
                  </span>
                  <p className="pt-0.5 text-sm font-semibold leading-6 text-slate-900">
                    {question.text}
                  </p>
                </div>
                {question.type === 'open' ? (
                  <Textarea
                    className="mt-4"
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
                  <ul
                    className="mt-4 space-y-2"
                    role={question.type === 'single' ? 'radiogroup' : undefined}
                    aria-label={question.type === 'single' ? question.text : undefined}
                  >
                    {question.options.map((option) => {
                      const checked = answer.optionIds.includes(option.id);
                      const isCorrectOption = feedback?.correctOptionIds?.includes(option.id);
                      const isWrongSelected =
                        feedback &&
                        !feedback.correct &&
                        feedback.selectedOptionIds?.includes(option.id);
                      return (
                        <li key={option.id}>
                          <div
                            className={cn(
                              'flex items-start gap-2 rounded-lg border bg-surface px-3 py-3 text-sm transition-colors',
                              checked && !feedback && 'border-primary-300 bg-primary-50',
                              isCorrectOption && 'border-emerald-300 bg-emerald-50',
                              isWrongSelected && 'border-red-300 bg-red-50',
                            )}
                          >
                            {question.type === 'single' ? (
                              <label className="flex w-full cursor-pointer items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={`quiz-${quiz.id}-question-${question.id}`}
                                  checked={checked}
                                  disabled={disabled || showResult}
                                  onChange={() => toggleOption(question, option.id)}
                                  className="size-4 accent-primary-600"
                                />
                                <span>{option.text}</span>
                              </label>
                            ) : (
                              <Checkbox
                                checked={checked}
                                disabled={disabled || showResult}
                                onCheckedChange={() => toggleOption(question, option.id)}
                                label={option.text}
                                className="w-full"
                              />
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {feedback?.explanation ? (
                  <div
                    className={cn(
                      'mt-3 rounded-lg border px-3 py-2.5 text-sm leading-6',
                      feedback.correct
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-red-200 bg-red-50 text-red-900',
                    )}
                  >
                    <p className="font-semibold">{feedback.correct ? 'Верно' : 'Разберём ответ'}</p>
                    <p className="mt-0.5 opacity-90">{feedback.explanation}</p>
                  </div>
                ) : null}
                {feedback && !feedback.explanation ? (
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

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          {!showResult ? (
            <p className="text-xs text-slate-500">
              {complete
                ? 'Все вопросы заполнены — можно проверить ответы'
                : `Ответьте ещё на ${quiz.questions.length - answeredCount}`}
            </p>
          ) : (
            <span />
          )}
          {!showResult ? (
            <Button
              disabled={disabled || submitting || !complete}
              loading={submitting}
              onClick={() => onSubmit(draftToAnswers(draft))}
            >
              Проверить ответы
            </Button>
          ) : lastResult?.passed && onContinue ? (
            <Button onClick={onContinue}>Завершить и продолжить</Button>
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
      </div>
    </section>
  );
}
