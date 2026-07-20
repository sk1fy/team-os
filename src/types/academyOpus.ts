/**
 * Типы «Академии Opus» — параллельной реализации раздела Академии.
 *
 * Базовые сущности (Course, Lesson, Quiz, CourseProgress) переиспользуются
 * из основного контракта в @/types: обе Академии работают с одними данными,
 * поэтому их можно честно сравнить на одном наборе курсов.
 *
 * Здесь описано только то, чего в базовом контракте не хватает: ответы на
 * тест, результат проверки, развёрнутые назначения и сертификаты.
 */

import type { CourseProgressStatus, ID, ISODate } from './index';

// ============================================================================
// Тестирование
// ============================================================================

/** Ответ пользователя на один вопрос теста. */
export interface QuizAnswer {
  questionId: ID;
  /** Выбранные варианты — для вопросов single и multiple. */
  optionIds?: ID[];
  /** Свободный текст — для вопросов open. */
  text?: string;
}

/**
 * Итог по одному вопросу. `pending` — открытый вопрос, который ждёт
 * ручной проверки и потому не участвует в автоматическом балле.
 */
export type QuestionOutcome = 'correct' | 'incorrect' | 'pending';

export interface QuestionResult {
  questionId: ID;
  outcome: QuestionOutcome;
  /** Правильные варианты — показываем в разборе после исчерпания попыток. */
  correctOptionIds: ID[];
  givenOptionIds: ID[];
}

export interface QuizGrade {
  /** Балл в процентах по автоматически проверяемым вопросам, 0–100. */
  score: number;
  passed: boolean;
  /** В тесте есть открытые вопросы — нужна ручная проверка. */
  pendingReview: boolean;
  results: QuestionResult[];
  /** Сколько вопросов проверено автоматически. */
  autoGradedCount: number;
  correctCount: number;
}

/**
 * Развёрнутые данные попытки: сами ответы и результат ручной проверки.
 * Хранятся отдельно от QuizAttempt, чтобы не менять базовый контракт.
 */
export interface QuizAttemptDetail {
  attemptId: ID;
  quizId: ID;
  courseId: ID;
  lessonId: ID;
  userId: ID;
  answers: QuizAnswer[];
  /** Решение проверяющего по открытым вопросам: questionId → зачтено. */
  openReview?: Record<ID, boolean>;
  reviewerId?: ID;
  reviewComment?: string;
  reviewedAt?: ISODate;
  createdAt: ISODate;
}

/** Строка очереди ручной проверки открытых ответов. */
export interface ReviewQueueItem {
  detail: QuizAttemptDetail;
  courseTitle: string;
  lessonTitle: string;
  userId: ID;
}

// ============================================================================
// Назначения
// ============================================================================

/**
 * Назначение, развёрнутое до конкретного человека: групповые назначения
 * на должность и отдел превращаются в персональные строки.
 */
export interface LearnerAssignment {
  userId: ID;
  courseId: ID;
  assignmentId: ID;
  assignedAt: ISODate;
  /** Итоговый дедлайн: явный из назначения либо из deadlineDays курса. */
  dueDate?: ISODate;
  /** Как курс попал к человеку — показываем в отчёте. */
  via: 'user' | 'position' | 'department';
}

/** Строка отчёта: по одному человеку на курс, включая не начавших. */
export interface LearnerRow {
  userId: ID;
  courseId: ID;
  status: CourseProgressStatus;
  /** Доля пройденных уроков, 0–100. */
  percent: number;
  completedLessons: number;
  totalLessons: number;
  assignedAt: ISODate;
  dueDate?: ISODate;
  startedAt?: ISODate;
  completedAt?: ISODate;
  /** Есть попытки, ждущие ручной проверки. */
  pendingReview: boolean;
  /** Лучший балл по тестам курса, если попытки были. */
  bestScore?: number;
  via: LearnerAssignment['via'];
}

/** Сводка над таблицей отчёта. */
export interface ProgressSummary {
  assigned: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  /** Средний процент прохождения по всем назначенным, 0–100. */
  averagePercent: number;
  pendingReview: number;
}

// ============================================================================
// Сертификаты
// ============================================================================

export interface Certificate {
  id: ID;
  /** Человекочитаемый номер для проверки: TOS-2026-000123. */
  number: string;
  userId: ID;
  courseId: ID;
  issuedAt: ISODate;
  /** Срок действия — для курсов с ресертификацией. */
  expiresAt?: ISODate;
}
