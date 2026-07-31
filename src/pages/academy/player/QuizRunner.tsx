import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, CircleHelp, RotateCcw, XCircle } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';
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
              'mt-5 rounded-xl border px-4 py-3 outline-none',
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

        <ol className="mt-6 divide-y divide-slate-200">
          {quiz.questions.map((question, index) => {
            const feedback = lastResult?.feedback.find((f) => f.questionId === question.id);
            const answer = draft[question.id] ?? { optionIds: [], openText: '' };
            return (
              <li key={question.id} className="py-6 first:pt-0 last:pb-0">
                <div className="flex items-baseline gap-2.5">
                  <span className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Q{index + 1}
                  </span>
                  <h4 className="text-sm font-semibold leading-6 text-slate-950">
                    {question.text}
                  </h4>
                </div>
                {question.type === 'open' ? (
                  <Textarea
                    className={cn(
                      'mt-3',
                      feedback?.correct && 'border-emerald-400 bg-emerald-50 text-emerald-900',
                      feedback && !feedback.correct && 'border-red-400 bg-red-50 text-red-900',
                    )}
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
                    className="mt-3 space-y-2"
                    role={question.type === 'single' ? 'radiogroup' : undefined}
                    aria-label={question.type === 'single' ? question.text : undefined}
                  >
                    {question.options.map((option) => {
                      const checked = answer.optionIds.includes(option.id);
                      const isCorrectOption =
                        feedback?.correctOptionIds?.includes(option.id) ||
                        (feedback?.correct && feedback.selectedOptionIds?.includes(option.id));
                      const isWrongSelected =
                        feedback &&
                        !feedback.correct &&
                        feedback.selectedOptionIds?.includes(option.id);
                      const resultTone = isCorrectOption
                        ? 'correct'
                        : isWrongSelected
                          ? 'incorrect'
                          : 'neutral';
                      return (
                        <li key={option.id}>
                          <label
                            className={cn(
                              'group flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm leading-5 transition-colors',
                              !disabled && !showResult && 'cursor-pointer hover:border-slate-400',
                              disabled && !showResult && 'cursor-not-allowed opacity-60',
                              !feedback && !checked && 'border-slate-200 bg-surface text-slate-700',
                              !feedback &&
                                checked &&
                                'border-primary-400 bg-primary-50 text-primary-900',
                              feedback &&
                                resultTone === 'correct' &&
                                'border-emerald-400 bg-emerald-50 text-emerald-900',
                              feedback &&
                                resultTone === 'incorrect' &&
                                'border-red-400 bg-red-50 text-red-900',
                              feedback &&
                                resultTone === 'neutral' &&
                                'border-slate-200 bg-slate-50 text-slate-500',
                            )}
                          >
                            <input
                              type={question.type === 'single' ? 'radio' : 'checkbox'}
                              name={`quiz-${quiz.id}-question-${question.id}`}
                              checked={checked}
                              disabled={disabled || showResult}
                              onChange={() => toggleOption(question, option.id)}
                              className="peer sr-only"
                            />
                            {!feedback ? (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'pointer-events-none flex size-4.5 shrink-0 items-center justify-center border bg-surface transition-colors',
                                  question.type === 'single' ? 'rounded-full' : 'rounded',
                                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-600',
                                  !checked && 'border-slate-300',
                                  checked && 'border-primary-600 bg-primary-600 text-white',
                                )}
                              >
                                {checked ? <Check className="size-3" strokeWidth={3} /> : null}
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1">{option.text}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {feedback?.explanation ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-700">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Пояснение
                    </p>
                    <p className="mt-1">{feedback.explanation}</p>
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
