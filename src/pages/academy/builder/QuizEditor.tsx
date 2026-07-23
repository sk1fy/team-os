import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Input, Select, Textarea } from '@/components/ui';
import { createId } from '@/lib/id';
import type { QuizAuthor, QuizQuestionAuthor } from '@/types/academy';

export interface QuizValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  questionId?: string;
}

export function validateQuiz(quiz: QuizAuthor): QuizValidationIssue[] {
  const issues: QuizValidationIssue[] = [];

  if (!Number.isFinite(quiz.passingScore) || quiz.passingScore < 0 || quiz.passingScore > 100) {
    issues.push({ severity: 'error', message: 'Проходной балл должен быть от 0 до 100.' });
  }
  if (quiz.maxAttempts != null && (!Number.isInteger(quiz.maxAttempts) || quiz.maxAttempts < 1)) {
    issues.push({ severity: 'error', message: 'Максимум попыток должен быть не меньше 1.' });
  }
  if (quiz.questions.length === 0) {
    issues.push({ severity: 'error', message: 'Добавьте хотя бы один вопрос.' });
  }

  quiz.questions.forEach((question, index) => {
    const prefix = `Вопрос ${index + 1}`;
    if (!question.text.trim()) {
      issues.push({
        severity: 'error',
        questionId: question.id,
        message: `${prefix}: заполните текст вопроса.`,
      });
    }

    if (question.type === 'open') {
      if (question.options.length > 0) {
        issues.push({
          severity: 'error',
          questionId: question.id,
          message: `${prefix}: у открытого вопроса не должно быть вариантов.`,
        });
      }
      return;
    }

    if (question.options.length < 2) {
      issues.push({
        severity: 'error',
        questionId: question.id,
        message: `${prefix}: добавьте минимум два варианта.`,
      });
    }
    if (question.options.some((option) => !option.text.trim())) {
      issues.push({
        severity: 'error',
        questionId: question.id,
        message: `${prefix}: заполните все варианты ответа.`,
      });
    }

    const correctCount = question.options.filter((option) => option.correct).length;
    if (question.type === 'single' && correctCount !== 1) {
      issues.push({
        severity: 'error',
        questionId: question.id,
        message: `${prefix}: выберите ровно один правильный вариант.`,
      });
    }
    if (question.type === 'multiple' && correctCount < 1) {
      issues.push({
        severity: 'error',
        questionId: question.id,
        message: `${prefix}: выберите минимум один правильный вариант.`,
      });
    }

    const normalizedOptions = question.options
      .map((option) => option.text.trim().toLocaleLowerCase())
      .filter(Boolean);
    if (new Set(normalizedOptions).size !== normalizedOptions.length) {
      issues.push({
        severity: 'warning',
        questionId: question.id,
        message: `${prefix}: есть одинаковые варианты ответа.`,
      });
    }
  });

  return issues;
}

export function QuizEditor({
  quiz,
  onChange,
  onRemove,
  disabled,
}: {
  quiz: QuizAuthor;
  onChange: (quiz: QuizAuthor) => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const validationIssues = validateQuiz(quiz);

  const updateQuestion = (questionId: string, patch: Partial<QuizQuestionAuthor>) => {
    onChange({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
    });
  };

  const moveQuestion = (questionId: string, direction: -1 | 1) => {
    const currentIndex = quiz.questions.findIndex((question) => question.id === questionId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= quiz.questions.length) return;
    const questions = quiz.questions.slice();
    const [moved] = questions.splice(currentIndex, 1);
    if (!moved) return;
    questions.splice(targetIndex, 0, moved);
    onChange({ ...quiz, questions });
    window.requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLElement>('[data-quiz-question]'))
        .find((element) => element.dataset.quizQuestion === questionId)
        ?.querySelector<HTMLElement>('input')
        ?.focus();
    });
  };

  const moveOption = (question: QuizQuestionAuthor, optionId: string, direction: -1 | 1) => {
    const currentIndex = question.options.findIndex((option) => option.id === optionId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= question.options.length) return;
    const options = question.options.slice();
    const [moved] = options.splice(currentIndex, 1);
    if (!moved) return;
    options.splice(targetIndex, 0, moved);
    updateQuestion(question.id, { options });
    window.requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLElement>('[data-quiz-option]'))
        .find((element) => element.dataset.quizOption === optionId)
        ?.querySelector<HTMLElement>('input')
        ?.focus();
    });
  };

  const addQuestion = () => {
    const question: QuizQuestionAuthor = {
      id: createId(),
      type: 'single',
      text: 'Новый вопрос',
      required: true,
      options: [
        { id: createId(), text: 'Вариант 1', correct: true },
        { id: createId(), text: 'Вариант 2', correct: false },
      ],
    };
    onChange({ ...quiz, questions: [...quiz.questions, question] });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Тест урока</h3>
          <p className="text-xs text-slate-500">Правильные ответы видны только в author DTO</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="Проходной балл, %"
            type="number"
            min={0}
            max={100}
            className="w-32"
            value={String(quiz.passingScore)}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...quiz,
                passingScore: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
          <Input
            label="Максимум попыток"
            type="number"
            min={1}
            className="w-36"
            value={quiz.maxAttempts == null ? '' : String(quiz.maxAttempts)}
            placeholder="Без лимита"
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...quiz,
                maxAttempts: e.target.value ? Math.max(1, Number(e.target.value) || 1) : undefined,
              })
            }
          />
          {onRemove ? (
            <Button
              size="sm"
              variant="danger"
              disabled={disabled}
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
              Удалить тест
            </Button>
          ) : null}
        </div>
      </div>

      <ol className="space-y-4">
        {quiz.questions.map((question, index) => (
          <li
            key={question.id}
            data-quiz-question={question.id}
            className="rounded-lg border border-slate-200 bg-surface p-3"
          >
            <div className="flex items-start gap-2">
              <span className="mt-2 text-xs font-semibold text-slate-400">{index + 1}.</span>
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  value={question.text}
                  disabled={disabled}
                  onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                />
                <Select
                  label="Тип"
                  value={question.type}
                  disabled={disabled}
                  onValueChange={(value) =>
                    updateQuestion(question.id, {
                      type: value as QuizQuestionAuthor['type'],
                      options:
                        value === 'open'
                          ? []
                          : question.options.length > 0
                            ? question.options
                            : [
                                { id: createId(), text: 'Вариант 1', correct: true },
                                { id: createId(), text: 'Вариант 2', correct: false },
                              ],
                    })
                  }
                  options={[
                    { value: 'single', label: 'Один ответ' },
                    { value: 'multiple', label: 'Несколько ответов' },
                    { value: 'open', label: 'Открытый' },
                  ]}
                />
                <Checkbox
                  checked={question.required ?? true}
                  disabled={disabled}
                  onCheckedChange={(required) => updateQuestion(question.id, { required })}
                  label="Обязательный вопрос"
                />
                {question.type !== 'open' ? (
                  <ul className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <li
                        key={option.id}
                        data-quiz-option={option.id}
                        className="flex items-center gap-2"
                      >
                        {question.type === 'single' ? (
                          <label className="shrink-0">
                            <span className="sr-only">
                              Правильный ответ: {option.text || `вариант ${optionIndex + 1}`}
                            </span>
                            <input
                              type="radio"
                              name={`correct-answer-${question.id}`}
                              checked={option.correct}
                              disabled={disabled}
                              onChange={() =>
                                updateQuestion(question.id, {
                                  options: question.options.map((candidate) => ({
                                    ...candidate,
                                    correct: candidate.id === option.id,
                                  })),
                                })
                              }
                              className="size-4 accent-primary-600"
                            />
                          </label>
                        ) : (
                          <Checkbox
                            checked={option.correct}
                            disabled={disabled}
                            onCheckedChange={(checked) =>
                              updateQuestion(question.id, {
                                options: question.options.map((candidate) =>
                                  candidate.id === option.id
                                    ? { ...candidate, correct: checked }
                                    : candidate,
                                ),
                              })
                            }
                            label={`Правильный ответ: ${option.text || `вариант ${optionIndex + 1}`}`}
                            className="shrink-0 [&>span:last-child]:sr-only"
                          />
                        )}
                        <Input
                          className="flex-1"
                          value={option.text}
                          disabled={disabled}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              options: question.options.map((o) =>
                                o.id === option.id ? { ...o, text: e.target.value } : o,
                              ),
                            })
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={disabled || optionIndex === 0}
                          aria-label={`Переместить вариант ${optionIndex + 1} выше`}
                          onClick={() => moveOption(question, option.id, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={disabled || optionIndex === question.options.length - 1}
                          aria-label={`Переместить вариант ${optionIndex + 1} ниже`}
                          onClick={() => moveOption(question, option.id, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={disabled || question.options.length <= 2}
                          aria-label="Удалить вариант"
                          onClick={() =>
                            updateQuestion(question.id, {
                              options: question.options.filter((o) => o.id !== option.id),
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                    <li>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={disabled}
                        onClick={() =>
                          updateQuestion(question.id, {
                            options: [
                              ...question.options,
                              { id: createId(), text: `Вариант ${question.options.length + 1}`, correct: false },
                            ],
                          })
                        }
                      >
                        <Plus className="size-4" />
                        Вариант
                      </Button>
                    </li>
                  </ul>
                ) : null}
                <Input
                  label="Feedback после ответа (необязательно)"
                  value={question.feedback ?? ''}
                  disabled={disabled}
                  onChange={(event) =>
                    updateQuestion(question.id, { feedback: event.target.value || undefined })
                  }
                  placeholder="Короткий комментарий к результату"
                />
                <Textarea
                  label="Объяснение (необязательно)"
                  rows={2}
                  value={question.explanation ?? ''}
                  disabled={disabled}
                  onChange={(event) =>
                    updateQuestion(question.id, { explanation: event.target.value || undefined })
                  }
                  placeholder="Почему ответ верный и что стоит повторить"
                />
                {validationIssues
                  .filter((issue) => issue.questionId === question.id)
                  .map((issue) => (
                    <p
                      key={`${issue.severity}-${issue.message}`}
                      className={
                        issue.severity === 'error'
                          ? 'text-xs text-danger-600'
                          : 'text-xs text-amber-700'
                      }
                    >
                      {issue.message}
                    </p>
                  ))}
              </div>
              <div className="flex shrink-0 flex-col">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || index === 0}
                  aria-label={`Переместить вопрос ${index + 1} выше`}
                  onClick={() => moveQuestion(question.id, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || index === quiz.questions.length - 1}
                  aria-label={`Переместить вопрос ${index + 1} ниже`}
                  onClick={() => moveQuestion(question.id, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label="Удалить вопрос"
                  onClick={() =>
                    onChange({
                      ...quiz,
                      questions: quiz.questions.filter((q) => q.id !== question.id),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {validationIssues.some((issue) => !issue.questionId) ? (
        <div className="space-y-1" aria-live="polite">
          {validationIssues
            .filter((issue) => !issue.questionId)
            .map((issue) => (
              <p
                key={`${issue.severity}-${issue.message}`}
                className={
                  issue.severity === 'error'
                    ? 'text-xs text-danger-600'
                    : 'text-xs text-amber-700'
                }
              >
                {issue.message}
              </p>
            ))}
        </div>
      ) : null}

      <Button size="sm" variant="secondary" disabled={disabled} onClick={addQuestion}>
        <Plus className="size-4" />
        Добавить вопрос
      </Button>
    </div>
  );
}

export function createEmptyQuiz(lessonId: string): QuizAuthor {
  return {
    id: createId(),
    lessonId,
    passingScore: 70,
    questions: [
      {
        id: createId(),
        type: 'single',
        text: 'Вопрос 1',
        required: true,
        options: [
          { id: createId(), text: 'Правильный ответ', correct: true },
          { id: createId(), text: 'Неправильный ответ', correct: false },
        ],
      },
    ],
  };
}
