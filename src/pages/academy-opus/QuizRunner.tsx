/**
 * Прохождение теста урока.
 *
 * В базовой Академии эта часть — витрина: поля не управляемые, ответы никуда
 * не уходят, а кнопка просто отмечает урок пройденным. Здесь ответы
 * собираются, отправляются в API, балл считается там же, и урок
 * засчитывается только при сдаче.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock, RotateCcw, X } from 'lucide-react';
import type { ID, Quiz, QuizAttempt } from '@/types';
import type { QuizAnswer, QuizGrade } from '@/types/academyOpus';
import { Button, Badge, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { attemptsLeft, canAttempt } from '@/lib/quizScoring';
import { plural } from '@/lib/format';

export function QuizRunner({
  quiz,
  attempts,
  onSubmit,
  submitting,
}: {
  quiz: Quiz;
  attempts: QuizAttempt[];
  onSubmit: (answers: QuizAnswer[]) => Promise<QuizGrade | undefined>;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<ID, QuizAnswer>>({});
  const [grade, setGrade] = useState<QuizGrade | null>(null);

  const passedAttempt = attempts.find((attempt) => attempt.passed);
  const pendingAttempt = attempts.find((attempt) => attempt.pendingReview);
  const left = attemptsLeft(quiz, attempts.length);
  const allowed = canAttempt(quiz, attempts);

  const unanswered = useMemo(
    () =>
      quiz.questions.filter((question) => {
        const answer = answers[question.id];
        if (question.type === 'open') return !answer?.text?.trim();
        return !answer?.optionIds?.length;
      }).length,
    [answers, quiz.questions],
  );

  function setSingle(questionId: ID, optionId: ID) {
    setAnswers((current) => ({ ...current, [questionId]: { questionId, optionIds: [optionId] } }));
  }

  function toggleMultiple(questionId: ID, optionId: ID) {
    setAnswers((current) => {
      const selected = current[questionId]?.optionIds ?? [];
      const next = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId];
      return { ...current, [questionId]: { questionId, optionIds: next } };
    });
  }

  function setText(questionId: ID, text: string) {
    setAnswers((current) => ({ ...current, [questionId]: { questionId, text } }));
  }

  async function submit() {
    const payload = quiz.questions.map(
      (question) => answers[question.id] ?? { questionId: question.id },
    );
    const result = await onSubmit(payload);
    if (result) setGrade(result);
  }

  function retry() {
    setAnswers({});
    setGrade(null);
  }

  // Результат последней попытки: разбор с подсветкой правильных ответов.
  if (grade) {
    return (
      <QuizResult
        quiz={quiz}
        grade={grade}
        attemptsUsed={attempts.length}
        onRetry={canAttempt(quiz, attempts) ? retry : undefined}
      />
    );
  }

  if (passedAttempt) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">
        <Check className="size-5 shrink-0" />
        <span>
          Тест сдан на {passedAttempt.score}%. Проходной балл — {quiz.passingScore}%.
        </span>
      </div>
    );
  }

  if (pendingAttempt) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <Clock className="size-5 shrink-0" />
        <span>
          Ответы отправлены на проверку. Результат появится здесь после решения проверяющего.
        </span>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600">
        <AlertTriangle className="size-5 shrink-0" />
        <span>Попытки исчерпаны. Обратитесь к владельцу курса, чтобы открыть пересдачу.</span>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-surface p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Тест урока</h3>
          <p className="text-sm text-slate-500">
            Проходной балл — {quiz.passingScore}%.{' '}
            {left === null
              ? 'Число попыток не ограничено.'
              : `Осталось ${left} ${plural(left, ['попытка', 'попытки', 'попыток'])}.`}
          </p>
        </div>
        <Badge variant="neutral">
          {quiz.questions.length} {plural(quiz.questions.length, ['вопрос', 'вопроса', 'вопросов'])}
        </Badge>
      </div>

      <div className="space-y-4">
        {quiz.questions.map((question, index) => (
          <fieldset
            key={question.id}
            className="rounded-md border border-slate-200 bg-surface-muted p-4"
          >
            <legend className="px-1 text-xs font-semibold text-slate-400">
              Вопрос {index + 1}
              {question.type === 'multiple' && ' · несколько ответов'}
              {question.type === 'open' && ' · развёрнутый ответ'}
            </legend>
            <p className="text-sm font-medium text-slate-900">{question.text}</p>

            {question.type === 'open' ? (
              <Textarea
                rows={3}
                className="mt-3"
                value={answers[question.id]?.text ?? ''}
                onChange={(event) => setText(question.id, event.target.value)}
                placeholder="Ответ уйдёт на проверку владельцу курса"
              />
            ) : (
              <div className="mt-3 space-y-2">
                {question.options.map((option) => {
                  const selected = answers[question.id]?.optionIds?.includes(option.id) ?? false;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors',
                        selected
                          ? 'border-primary-300 bg-primary-50 text-primary-800'
                          : 'border-slate-200 bg-surface hover:bg-slate-50',
                      )}
                    >
                      <input
                        type={question.type === 'single' ? 'radio' : 'checkbox'}
                        name={question.id}
                        checked={selected}
                        onChange={() =>
                          question.type === 'single'
                            ? setSingle(question.id, option.id)
                            : toggleMultiple(question.id, option.id)
                        }
                        className="size-4 accent-primary-600"
                      />
                      {option.text}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {unanswered > 0 && (
          <span className="text-sm text-slate-500">
            Без ответа: {unanswered} из {quiz.questions.length}
          </span>
        )}
        <Button onClick={() => void submit()} loading={submitting} disabled={unanswered > 0}>
          Отправить ответы
        </Button>
      </div>
    </section>
  );
}

function QuizResult({
  quiz,
  grade,
  attemptsUsed,
  onRetry,
}: {
  quiz: Quiz;
  grade: QuizGrade;
  attemptsUsed: number;
  onRetry?: () => void;
}) {
  const left = attemptsLeft(quiz, attemptsUsed);

  return (
    <section className="rounded-lg border border-slate-200 bg-surface p-5 shadow-card">
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3',
          grade.pendingReview
            ? 'bg-warning-50 text-warning-700'
            : grade.passed
              ? 'bg-success-50 text-success-700'
              : 'bg-danger-50 text-danger-600',
        )}
      >
        <div className="flex items-center gap-3">
          {grade.pendingReview ? (
            <Clock className="size-5" />
          ) : grade.passed ? (
            <Check className="size-5" />
          ) : (
            <X className="size-5" />
          )}
          <div>
            <p className="font-semibold">
              {grade.pendingReview
                ? 'Ответы отправлены на проверку'
                : grade.passed
                  ? `Тест сдан — ${grade.score}%`
                  : `Тест не сдан — ${grade.score}%`}
            </p>
            <p className="text-sm">
              {grade.pendingReview
                ? `Автоматически проверено ${grade.correctCount} из ${grade.autoGradedCount}, открытые вопросы ждут владельца курса.`
                : `Верно ${grade.correctCount} из ${grade.autoGradedCount}, проходной балл — ${quiz.passingScore}%.`}
            </p>
          </div>
        </div>
        {!grade.passed && !grade.pendingReview && onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RotateCcw className="size-4" />
            Ещё попытка
            {left !== null && ` (${left})`}
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {quiz.questions.map((question, index) => {
          const result = grade.results.find((item) => item.questionId === question.id);
          if (!result) return null;

          return (
            <div key={question.id} className="rounded-md border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">
                  {index + 1}. {question.text}
                </p>
                <Badge
                  variant={
                    result.outcome === 'correct'
                      ? 'success'
                      : result.outcome === 'pending'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {result.outcome === 'correct'
                    ? 'Верно'
                    : result.outcome === 'pending'
                      ? 'На проверке'
                      : 'Неверно'}
                </Badge>
              </div>

              {result.outcome === 'incorrect' && (
                <p className="mt-2 text-sm text-slate-500">
                  Правильный ответ:{' '}
                  <span className="font-medium text-slate-700">
                    {question.options
                      .filter((option) => result.correctOptionIds.includes(option.id))
                      .map((option) => option.text)
                      .join(', ')}
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
