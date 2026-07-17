/**
 * Типы данных всех сущностей TeamOS.
 *
 * Это контракт между фронтендом и будущим бэкендом: мок-API возвращает
 * данные ровно в этих интерфейсах, поэтому при подключении реального API
 * компоненты не меняются.
 */

export type ID = string;

/** ISO-8601 строка даты-времени, как её отдаст бэкенд. */
export type ISODate = string;

/**
 * Контент rich-text редактора хранится как TipTap JSON (не HTML) —
 * он конвертируется в уроки Академии и пригоден для AI-генерации.
 */
export type RichTextContent = {
  type: 'doc';
  content?: unknown[];
};

// ============================================================================
// Компания и люди
// ============================================================================

export interface Company {
  id: ID;
  name: string;
  logoUrl?: string;
  ownerId: ID;
  /** ID аккаунта amoCRM для интеграции. */
  amoAccountId?: string;
  createdAt: ISODate;
}

export type UserRole = 'owner' | 'admin' | 'employee' | 'partner';
export type UserStatus = 'active' | 'invited' | 'deactivated';
export type UserSource = 'local' | 'amo';
export type EmployeeAccessMode = 'none' | 'password' | 'link';

export interface EmployeeAccess {
  mode: EmployeeAccessMode;
  linkToken?: string;
  linkCreatedAt?: ISODate;
}

export interface User {
  id: ID;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  /** Не более одной должности; массив сохранён для совместимости API. */
  positionIds: ID[];
  /** Дата рождения — отметки 🎂 в графике и поздравления. */
  birthDate?: ISODate;
  /** Дата выхода на работу — стаж и годовщины 🎉 в графике. */
  hiredAt?: ISODate;
  /** Базовая норма отпуска сотрудника в днях за год. */
  vacationAllowance?: number;
  /** Источник пользователя: local — создан в TeamOS, amo — импортирован из amoCRM. */
  source?: UserSource;
  /** Способ входа сотрудника, если доступ уже выдан владельцем. */
  accessMode?: EmployeeAccessMode;
  createdAt: ISODate;
}

export interface Department {
  id: ID;
  name: string;
  /** null — корневой отдел компании. */
  parentId: ID | null;
  headUserId?: ID;
  /** Ценный конечный продукт отдела. */
  valuableFinalProduct?: string;
  /** Порядок среди соседей в дереве. */
  order: number;
}

export interface Position {
  id: ID;
  name: string;
  departmentId: ID;
  /** Уровень управленческой иерархии: 4 — верхний, 0 — нижний. */
  level?: 0 | 1 | 2 | 3 | 4;
  /** Описание функций должности. */
  description?: string;
  /** Регламенты (статьи БЗ), привязанные к должности. */
  articleIds: ID[];
  /** Обязательные курсы для должности. */
  requiredCourseIds: ID[];
}

export type InviteStatus = 'pending' | 'accepted' | 'expired';

export interface Invite {
  id: ID;
  email?: string;
  /** Токен инвайт-ссылки. */
  token: string;
  role: UserRole;
  positionId?: ID;
  departmentId?: ID;
  invitedById: ID;
  status: InviteStatus;
  createdAt: ISODate;
}

// ============================================================================
// Доступы (общий механизм для БЗ и Академии)
// ============================================================================

export type AccessScope = 'company' | 'custom';

export interface AccessSettings {
  scope: AccessScope;
  departmentIds: ID[];
  positionIds: ID[];
  userIds: ID[];
}

// ============================================================================
// База знаний
// ============================================================================

export interface ArticleSection {
  id: ID;
  name: string;
  /** null — раздел верхнего уровня. */
  parentId: ID | null;
  order: number;
  /** Доступ наследуется дочерними разделами, если у них scope не переопределён. */
  access: AccessSettings;
}

export type ArticleStatus = 'draft' | 'published';

export interface Article {
  id: ID;
  sectionId: ID;
  title: string;
  content: RichTextContent;
  status: ArticleStatus;
  authorId: ID;
  /** Текущий номер версии; история — в ArticleVersion. */
  version: number;
  /** Требуется ли отметка «Ознакомлен». */
  requiresAcknowledgement: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface ArticleVersion {
  id: ID;
  articleId: ID;
  version: number;
  title: string;
  content: RichTextContent;
  authorId: ID;
  createdAt: ISODate;
}

export interface Acknowledgement {
  articleId: ID;
  userId: ID;
  acknowledgedAt: ISODate;
}

// ============================================================================
// Таск-трекер
// ============================================================================

export type BoardType = 'personal' | 'department' | 'project';

export interface Board {
  id: ID;
  name: string;
  type: BoardType;
  /** Для type = 'department'. */
  departmentId?: ID;
  /** Для type = 'personal'. */
  ownerId?: ID;
  createdAt: ISODate;
}

export interface TaskColumn {
  id: ID;
  boardId: ID;
  name: string;
  order: number;
  color?: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Label {
  id: ID;
  name: string;
  /** Tailwind-совместимый цвет, например 'red' | 'amber' | 'indigo'. */
  color: string;
}

export interface ChecklistItem {
  id: ID;
  text: string;
  done: boolean;
}

export interface Attachment {
  id: ID;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

export type TaskSourceType = 'task' | 'contact' | 'company' | 'deal';

export interface TaskSource {
  type: TaskSourceType;
  title: string;
  url: string;
  funnelName?: string;
  stageName?: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Каждые N дней/недель/месяцев. */
  interval: number;
  /** Дни недели для weekly: 0 (вс) — 6 (сб). */
  weekdays?: number[];
}

export interface Task {
  id: ID;
  boardId: ID;
  columnId: ID;
  /** Порядок внутри колонки. */
  order: number;
  title: string;
  description?: RichTextContent;
  authorId: ID;
  /** Исполнители-люди. */
  assigneeIds: ID[];
  /** Либо назначение на должность (кто занимает — тот и исполнитель). */
  assigneePositionId?: ID;
  watcherIds: ID[];
  dueDate?: ISODate;
  priority: TaskPriority;
  labelIds: ID[];
  checklist: ChecklistItem[];
  attachments: Attachment[];
  /** CRM-контекст задачи: ссылка на задачу/объект и, если есть, воронка + этап. */
  source?: TaskSource;
  /** Привязанные статьи БЗ (регламенты к задаче). */
  linkedArticleIds: ID[];
  recurrence?: RecurrenceRule;
  completedAt?: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface TaskComment {
  id: ID;
  taskId: ID;
  authorId: ID;
  content: RichTextContent;
  createdAt: ISODate;
}

// ============================================================================
// Академия
// ============================================================================

export type CourseStatus = 'draft' | 'published';

export interface Course {
  id: ID;
  title: string;
  description?: string;
  coverUrl?: string;
  status: CourseStatus;
  authorId: ID;
  /** Последовательное прохождение: следующий урок открывается после предыдущего. */
  sequential: boolean;
  /** Дедлайн в днях с момента назначения. */
  deadlineDays?: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface CourseSection {
  id: ID;
  courseId: ID;
  title: string;
  order: number;
}

/** Режим импорта статьи БЗ в урок. */
export type LessonSourceMode = 'link' | 'copy';

export interface Lesson {
  id: ID;
  courseId: ID;
  sectionId: ID;
  title: string;
  order: number;
  content: RichTextContent;
  /** Если урок создан из статьи БЗ. */
  sourceArticleId?: ID;
  /** 'link' — синхронизирован с БЗ (контент не редактируется), 'copy' — отвязан. */
  sourceMode?: LessonSourceMode;
  quizId?: ID;
}

export type QuizQuestionType = 'single' | 'multiple' | 'open';

export interface QuizOption {
  id: ID;
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  id: ID;
  type: QuizQuestionType;
  text: string;
  /** Для single/multiple. */
  options: QuizOption[];
}

export interface Quiz {
  id: ID;
  lessonId: ID;
  questions: QuizQuestion[];
  /** Проходной балл в процентах, 0–100. */
  passingScore: number;
  /** Число попыток; undefined — без ограничений. */
  maxAttempts?: number;
}

export type AssigneeType = 'user' | 'position' | 'department' | 'external';

export interface CourseAssignment {
  id: ID;
  courseId: ID;
  assigneeType: AssigneeType;
  /** ID пользователя / должности / отдела; для external — не задан. */
  assigneeId?: ID;
  /** Инвайт-ссылка для внешних партнёров. */
  inviteToken?: string;
  dueDate?: ISODate;
  assignedById: ID;
  createdAt: ISODate;
}

export type CourseProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export interface QuizAttempt {
  id: ID;
  quizId: ID;
  userId: ID;
  /** Балл в процентах, 0–100. */
  score: number;
  passed: boolean;
  /** Ответы на открытые вопросы ждут ручной проверки. */
  pendingReview: boolean;
  createdAt: ISODate;
}

export interface CourseProgress {
  userId: ID;
  courseId: ID;
  status: CourseProgressStatus;
  completedLessonIds: ID[];
  quizAttempts: QuizAttempt[];
  startedAt?: ISODate;
  completedAt?: ISODate;
}

// ============================================================================
// Уведомления
// ============================================================================

export type NotificationType =
  | 'task_assigned'
  | 'task_comment'
  | 'task_due'
  | 'article_published'
  | 'article_ack_required'
  | 'course_assigned'
  | 'course_due'
  | 'mention';

export interface AppNotification {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  body?: string;
  /** Внутренний роут для перехода по клику. */
  link?: string;
  read: boolean;
  createdAt: ISODate;
}

// ============================================================================
// График работы
// ============================================================================

/** Тип дня в графике сотрудника. */
export type ShiftType = 'work' | 'off' | 'vacation' | 'sick' | 'trip';

/** Пятидневка (или произвольный набор дней недели) с единым временем смены. */
export interface WeekTemplate {
  type: 'week';
  /** Рабочие дни недели: 0 = Пн … 6 = Вс. */
  days: number[];
  /** Время смены в формате HH:MM. */
  start: string;
  end: string;
}

/** Сменный график: цикл «on рабочих / off выходных» от даты старта. */
export interface CycleTemplate {
  type: 'cycle';
  on: number;
  off: number;
  start: string;
  end: string;
  /** Первый рабочий день цикла, YYYY-MM-DD. */
  cycleStart: string;
}

export type ScheduleTemplate = WeekTemplate | CycleTemplate;

/** Базовый шаблон графика сотрудника. */
export interface UserSchedule {
  userId: ID;
  template: ScheduleTemplate;
}

/** Точечное отклонение от шаблона на конкретную дату (правка, отпуск, больничный…). */
export interface ShiftException {
  id: ID;
  userId: ID;
  /** Дата в формате YYYY-MM-DD. */
  date: string;
  type: ShiftType;
  /** Для type='work' — фактическое время смены. */
  start?: string;
  end?: string;
  note?: string;
}

// ============================================================================
// Распределение сделок
// ============================================================================

export type DistributionAlgorithm = 'round_robin' | 'least_loaded' | 'priority';
export type DistributionEventStatus = 'accepted' | 'in_progress' | 'reassigned' | 'declined';

export interface DealDistributionGroup {
  id: ID;
  name: string;
  description?: string;
  active: boolean;
  algorithm: DistributionAlgorithm;
  /** Порядок участников важен для очереди и приоритетов. */
  memberIds: ID[];
  /** Участники остаются в группе, но временно исключаются из распределения. */
  disabledMemberIds: ID[];
  source: string;
  dealLimit: number;
  unclaimedMinutes: number;
  createdAt: ISODate;
}

export interface DistributionEvent {
  id: ID;
  groupId: ID;
  dealNumber: number;
  userId: ID;
  status: DistributionEventStatus;
  createdAt: ISODate;
}
