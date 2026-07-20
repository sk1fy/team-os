import { describe, expect, it } from 'vitest';
import type { Quiz, QuizAttempt, QuizQuestion } from '@/types';
import {
  attemptsLeft,
  bestScore,
  canAttempt,
  gradeQuestion,
  gradeQuiz,
  gradeWithReview,
} from './quizScoring';

function single(id: string): QuizQuestion {
  return {
    id,
    type: 'single',
    text: 'Вопрос',
    options: [
      { id: `${id}-a`, text: 'А', correct: true },
      { id: `${id}-b`, text: 'Б', correct: false },
    ],
  };
}

function multiple(id: string): QuizQuestion {
  return {
    id,
    type: 'multiple',
    text: 'Вопрос',
    options: [
      { id: `${id}-a`, text: 'А', correct: true },
      { id: `${id}-b`, text: 'Б', correct: true },
      { id: `${id}-c`, text: 'В', correct: false },
    ],
  };
}

function open(id: string): QuizQuestion {
  return { id, type: 'open', text: 'Опишите', options: [] };
}

function makeQuiz(questions: QuizQuestion[], overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    lessonId: 'lesson-1',
    questions,
    passingScore: overrides.passingScore ?? 80,
    maxAttempts: overrides.maxAttempts,
  };
}

function makeAttempt(input: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: input.id ?? 'attempt-1',
    quizId: input.quizId ?? 'quiz-1',
    userId: input.userId ?? 'user-1',
    score: input.score ?? 0,
    passed: input.passed ?? false,
    pendingReview: input.pendingReview ?? false,
    createdAt: input.createdAt ?? '2026-07-01T10:00:00.000Z',
  };
}

describe('gradeQuestion', () => {
  it('засчитывает single только за правильный вариант', () => {
    expect(gradeQuestion(single('q1'), { questionId: 'q1', optionIds: ['q1-a'] }).outcome).toBe(
      'correct',
    );
    expect(gradeQuestion(single('q1'), { questionId: 'q1', optionIds: ['q1-b'] }).outcome).toBe(
      'incorrect',
    );
  });

  it('не засчитывает multiple при неполном ответе', () => {
    expect(gradeQuestion(multiple('q1'), { questionId: 'q1', optionIds: ['q1-a'] }).outcome).toBe(
      'incorrect',
    );
  });

  it('не засчитывает multiple при выборе всех вариантов', () => {
    const result = gradeQuestion(multiple('q1'), {
      questionId: 'q1',
      optionIds: ['q1-a', 'q1-b', 'q1-c'],
    });
    expect(result.outcome).toBe('incorrect');
  });

  it('засчитывает multiple при точном совпадении независимо от порядка', () => {
    const result = gradeQuestion(multiple('q1'), {
      questionId: 'q1',
      optionIds: ['q1-b', 'q1-a'],
    });
    expect(result.outcome).toBe('correct');
  });

  it('считает вопрос без ответа неправильным', () => {
    expect(gradeQuestion(single('q1')).outcome).toBe('incorrect');
  });

  it('отправляет открытый вопрос на ручную проверку', () => {
    expect(gradeQuestion(open('q1'), { questionId: 'q1', text: 'Ответ' }).outcome).toBe('pending');
  });
});

describe('gradeQuiz', () => {
  it('считает балл в процентах и сдаёт при достижении проходного', () => {
    const quiz = makeQuiz([single('q1'), single('q2')], { passingScore: 50 });
    const grade = gradeQuiz(quiz, [{ questionId: 'q1', optionIds: ['q1-a'] }]);

    expect(grade.score).toBe(50);
    expect(grade.correctCount).toBe(1);
    expect(grade.passed).toBe(true);
  });

  it('не сдаёт ниже проходного балла', () => {
    const quiz = makeQuiz([single('q1'), single('q2')], { passingScore: 80 });
    const grade = gradeQuiz(quiz, [{ questionId: 'q1', optionIds: ['q1-a'] }]);

    expect(grade.score).toBe(50);
    expect(grade.passed).toBe(false);
  });

  it('при открытых вопросах не сдаёт сразу, а ждёт проверки', () => {
    const quiz = makeQuiz([single('q1'), open('q2')], { passingScore: 80 });
    const grade = gradeQuiz(quiz, [{ questionId: 'q1', optionIds: ['q1-a'] }]);

    expect(grade.pendingReview).toBe(true);
    expect(grade.passed).toBe(false);
    // Открытый вопрос не входит в знаменатель автоматического балла.
    expect(grade.autoGradedCount).toBe(1);
    expect(grade.score).toBe(100);
  });

  it('даёт нулевой балл, если все вопросы открытые', () => {
    const quiz = makeQuiz([open('q1')]);
    const grade = gradeQuiz(quiz, [{ questionId: 'q1', text: 'Ответ' }]);

    expect(grade.score).toBe(0);
    expect(grade.autoGradedCount).toBe(0);
    expect(grade.pendingReview).toBe(true);
  });

  it('не падает на тесте без вопросов', () => {
    const grade = gradeQuiz(makeQuiz([]), []);
    expect(grade.score).toBe(0);
    expect(grade.pendingReview).toBe(false);
  });
});

describe('gradeWithReview', () => {
  it('включает зачтённый открытый вопрос в общий балл', () => {
    const quiz = makeQuiz([single('q1'), open('q2')], { passingScore: 80 });
    const grade = gradeWithReview(quiz, [{ questionId: 'q1', optionIds: ['q1-a'] }], { q2: true });

    expect(grade.score).toBe(100);
    expect(grade.passed).toBe(true);
    expect(grade.pendingReview).toBe(false);
  });

  it('роняет балл, если открытый вопрос не зачтён', () => {
    const quiz = makeQuiz([single('q1'), open('q2')], { passingScore: 80 });
    const grade = gradeWithReview(quiz, [{ questionId: 'q1', optionIds: ['q1-a'] }], { q2: false });

    expect(grade.score).toBe(50);
    expect(grade.passed).toBe(false);
  });
});

describe('attemptsLeft и canAttempt', () => {
  it('без ограничения попыток возвращает null', () => {
    expect(attemptsLeft(makeQuiz([single('q1')]), 10)).toBeNull();
  });

  it('не уходит в минус при превышении лимита', () => {
    expect(attemptsLeft(makeQuiz([single('q1')], { maxAttempts: 2 }), 5)).toBe(0);
  });

  it('разрешает попытку, пока лимит не исчерпан', () => {
    const quiz = makeQuiz([single('q1')], { maxAttempts: 2 });
    expect(canAttempt(quiz, [makeAttempt()])).toBe(true);
    expect(canAttempt(quiz, [makeAttempt(), makeAttempt({ id: 'attempt-2' })])).toBe(false);
  });

  it('не даёт пересдавать уже сданный тест', () => {
    const quiz = makeQuiz([single('q1')], { maxAttempts: 5 });
    expect(canAttempt(quiz, [makeAttempt({ passed: true, score: 100 })])).toBe(false);
  });

  it('блокирует новую попытку, пока предыдущая на проверке', () => {
    const quiz = makeQuiz([open('q1')], { maxAttempts: 5 });
    expect(canAttempt(quiz, [makeAttempt({ pendingReview: true })])).toBe(false);
  });
});

describe('bestScore', () => {
  it('возвращает максимум по попыткам', () => {
    expect(bestScore([makeAttempt({ score: 40 }), makeAttempt({ id: 'a2', score: 90 })])).toBe(90);
  });

  it('возвращает undefined без попыток', () => {
    expect(bestScore([])).toBeUndefined();
  });
});
