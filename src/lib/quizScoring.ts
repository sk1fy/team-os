/**
 * Проверка тестов Академии Opus.
 *
 * Вся арифметика теста живёт здесь, а не в компонентах и не в API:
 * мок-API вызывает эти функции при отправке попытки, плеер — при показе
 * разбора, отчёт — при подсчёте лучшего балла.
 */

import type { ID, Quiz, QuizAttempt, QuizQuestion } from '@/types';
import type { QuizAnswer, QuestionResult, QuizGrade } from '@/types/academyOpus';

function sameOptionSet(given: ID[], correct: ID[]): boolean {
  if (given.length !== correct.length) return false;
  const givenSet = new Set(given);
  return correct.every((id) => givenSet.has(id));
}

function correctOptionIds(question: QuizQuestion): ID[] {
  return question.options.filter((option) => option.correct).map((option) => option.id);
}

/**
 * Проверяет один вопрос. Открытые вопросы всегда уходят на ручную проверку.
 *
 * Для multiple зачёт только за точное совпадение множеств — частичный балл
 * не начисляется, иначе «отметить всё» давало бы половину балла.
 */
export function gradeQuestion(question: QuizQuestion, answer?: QuizAnswer): QuestionResult {
  const given = answer?.optionIds ?? [];
  const correct = correctOptionIds(question);

  if (question.type === 'open') {
    return { questionId: question.id, outcome: 'pending', correctOptionIds: [], givenOptionIds: [] };
  }

  return {
    questionId: question.id,
    outcome: sameOptionSet(given, correct) ? 'correct' : 'incorrect',
    correctOptionIds: correct,
    givenOptionIds: given,
  };
}

/**
 * Считает балл попытки по автоматически проверяемым вопросам.
 *
 * Если в тесте одни открытые вопросы, автоматического балла нет: score = 0,
 * passed = false, всё решает ручная проверка.
 */
export function gradeQuiz(quiz: Quiz, answers: QuizAnswer[]): QuizGrade {
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const results = quiz.questions.map((question) =>
    gradeQuestion(question, byQuestion.get(question.id)),
  );

  const autoGraded = results.filter((result) => result.outcome !== 'pending');
  const correctCount = autoGraded.filter((result) => result.outcome === 'correct').length;
  const pendingReview = results.some((result) => result.outcome === 'pending');
  const score = autoGraded.length === 0 ? 0 : Math.round((correctCount / autoGraded.length) * 100);

  return {
    score,
    passed: !pendingReview && score >= quiz.passingScore,
    pendingReview,
    results,
    autoGradedCount: autoGraded.length,
    correctCount,
  };
}

/**
 * Пересчитывает балл после ручной проверки открытых вопросов:
 * открытые вопросы становятся обычными и входят в общий знаменатель.
 */
export function gradeWithReview(
  quiz: Quiz,
  answers: QuizAnswer[],
  openReview: Record<ID, boolean>,
): QuizGrade {
  const base = gradeQuiz(quiz, answers);
  const results: QuestionResult[] = base.results.map((result) =>
    result.outcome === 'pending'
      ? { ...result, outcome: openReview[result.questionId] ? 'correct' : 'incorrect' }
      : result,
  );

  const correctCount = results.filter((result) => result.outcome === 'correct').length;
  const score = results.length === 0 ? 0 : Math.round((correctCount / results.length) * 100);

  return {
    score,
    passed: score >= quiz.passingScore,
    pendingReview: false,
    results,
    autoGradedCount: results.length,
    correctCount,
  };
}

/** Попытки конкретного пользователя по конкретному тесту, старые сначала. */
export function attemptsOf(attempts: QuizAttempt[], quizId: ID, userId: ID): QuizAttempt[] {
  return attempts.filter((attempt) => attempt.quizId === quizId && attempt.userId === userId);
}

/** Сколько попыток осталось; null — ограничения нет. */
export function attemptsLeft(quiz: Quiz, used: number): number | null {
  if (quiz.maxAttempts === undefined) return null;
  return Math.max(0, quiz.maxAttempts - used);
}

/**
 * Можно ли начать ещё одну попытку. Успешно сданный тест больше не
 * пересдаётся, попытка на проверке блокирует новую до вердикта.
 */
export function canAttempt(quiz: Quiz, attempts: QuizAttempt[]): boolean {
  if (attempts.some((attempt) => attempt.passed)) return false;
  if (attempts.some((attempt) => attempt.pendingReview)) return false;
  const left = attemptsLeft(quiz, attempts.length);
  return left === null || left > 0;
}

/** Лучший балл среди попыток; undefined — попыток не было. */
export function bestScore(attempts: QuizAttempt[]): number | undefined {
  if (attempts.length === 0) return undefined;
  return Math.max(...attempts.map((attempt) => attempt.score));
}
