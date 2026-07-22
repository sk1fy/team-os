import { Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Input, Select } from '@/components/ui';
import { createId } from '@/lib/id';
import type { QuizAuthor, QuizQuestionAuthor } from '@/types/academy';

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
  const updateQuestion = (questionId: string, patch: Partial<QuizQuestionAuthor>) => {
    onChange({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
    });
  };

  const addQuestion = () => {
    const question: QuizQuestionAuthor = {
      id: createId(),
      type: 'single',
      text: 'Новый вопрос',
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
          <li key={question.id} className="rounded-lg border border-slate-200 bg-surface p-3">
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
                {question.type !== 'open' ? (
                  <ul className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <li key={option.id} className="flex items-center gap-2">
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
              </div>
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
          </li>
        ))}
      </ol>

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
        options: [
          { id: createId(), text: 'Правильный ответ', correct: true },
          { id: createId(), text: 'Неправильный ответ', correct: false },
        ],
      },
    ],
  };
}
