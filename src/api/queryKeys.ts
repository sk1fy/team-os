import type { ID } from '@/types';

export const scheduleQueryKeys = {
  all: ['schedule'] as const,
  templates: ['schedule', 'templates'] as const,
  exceptions: ['schedule', 'exceptions'] as const,
  exceptionsForMonth: (month: string) => ['schedule', 'exceptions', month] as const,
};

/**
 * Единая фабрика query-ключей. Ключи иерархичны, поэтому инвалидация
 * по префиксу (например, queryKeys.academy.all) затрагивает всё поддерево.
 */
export const queryKeys = {
  currentUser: ['currentUser'] as const,
  company: ['company'] as const,
  invite: (token: string) => ['invite', token] as const,
  users: {
    all: ['users'] as const,
    byId: (id: ID | null | undefined) => ['users', id] as const,
    access: (id: ID | null | undefined) => ['userAccess', id] as const,
  },
  departments: ['departments'] as const,
  positions: ['positions'] as const,
  kb: {
    articles: ['kb', 'articles'] as const,
    article: (id: ID | null | undefined) => ['kb', 'article', id] as const,
    sections: ['kb', 'sections'] as const,
    versions: ['kb', 'versions'] as const,
    versionsFor: (articleId: ID | null | undefined) => ['kb', 'versions', articleId] as const,
    acknowledgements: (articleId: ID | null | undefined) =>
      ['kb', 'acknowledgements', articleId] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    board: (boardId: ID | null | undefined) => ['tasks', boardId] as const,
    boards: ['tasks', 'boards'] as const,
    columns: (boardId: ID | null | undefined) => ['tasks', 'columns', boardId] as const,
    comments: ['tasks', 'comments'] as const,
    commentsFor: (taskId: ID | null | undefined) => ['tasks', 'comments', taskId] as const,
  },
  distribution: {
    groups: ['distribution', 'groups'] as const,
    events: (groupId: ID | null | undefined) => ['distribution', 'events', groupId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unreadCount: ['notifications', 'unreadCount'] as const,
  },
  academy: {
    all: ['academy'] as const,
    courses: ['academy', 'courses'] as const,
    course: (courseId: ID | null | undefined) => ['academy', 'course', courseId] as const,
    sections: ['academy', 'sections'] as const,
    sectionsFor: (courseId: ID | null | undefined) => ['academy', 'sections', courseId] as const,
    lessons: ['academy', 'lessons'] as const,
    lessonsFor: (courseId: ID | null | undefined) => ['academy', 'lessons', courseId] as const,
    allLessons: ['academy', 'lessons', 'all'] as const,
    quizzes: ['academy', 'quizzes'] as const,
    progress: ['academy', 'progress'] as const,
    assignments: ['academy', 'assignments'] as const,
    learnProgress: (courseId: ID | null | undefined) =>
      ['academy', 'learn', 'progress', courseId] as const,
    learnLessons: (courseId: ID | null | undefined) =>
      ['academy', 'learn', 'lessons', courseId] as const,
  },
  /**
   * Академия Opus — параллельная реализация раздела. Отдельное поддерево
   * ключей: данные те же, но набор запросов другой, и инвалидация одной
   * Академии не должна дёргать вторую.
   */
  academyOpus: {
    all: ['academy-opus'] as const,
    courses: ['academy-opus', 'courses'] as const,
    course: (courseId: ID | null | undefined) => ['academy-opus', 'course', courseId] as const,
    sectionsFor: (courseId: ID | null | undefined) =>
      ['academy-opus', 'sections', courseId] as const,
    lessons: ['academy-opus', 'lessons'] as const,
    lessonsFor: (courseId: ID | null | undefined) =>
      ['academy-opus', 'lessons', courseId] as const,
    quizzes: ['academy-opus', 'quizzes'] as const,
    progress: ['academy-opus', 'progress'] as const,
    progressFor: (courseId: ID | null | undefined) =>
      ['academy-opus', 'progress', courseId] as const,
    assignments: ['academy-opus', 'assignments'] as const,
    myAssignments: ['academy-opus', 'my-assignments'] as const,
    learnerRows: ['academy-opus', 'learner-rows'] as const,
    reviewQueue: ['academy-opus', 'review-queue'] as const,
    certificates: ['academy-opus', 'certificates'] as const,
    dropOff: (courseId: ID | null | undefined) => ['academy-opus', 'drop-off', courseId] as const,
  },
  schedule: scheduleQueryKeys,
  activity: {
    all: ['activity'] as const,
    settings: (accountId: string | undefined) => ['activity', accountId, 'settings'] as const,
    employees: (accountId: string | undefined) => ['activity', accountId, 'employees'] as const,
    pipelines: (accountId: string | undefined) => ['activity', accountId, 'pipelines'] as const,
    link: (accountId: string | undefined) => ['activity', accountId, 'link'] as const,
    telegramStatus: (accountId: string | undefined, panelId: string | undefined) =>
      ['activity', accountId, 'telegram', panelId] as const,
  },
  duplicates: {
    all: ['duplicates'] as const,
    settings: (accountId: string | undefined) => ['duplicates', accountId, 'settings'] as const,
    resources: (accountId: string | undefined) => ['duplicates', accountId, 'resources'] as const,
    paidStatus: (accountId: string | undefined) => ['duplicates', accountId, 'paid'] as const,
    rules: (accountId: string | undefined) => ['duplicates', accountId, 'rules'] as const,
    massStatus: (accountId: string | undefined) =>
      ['duplicates', accountId, 'mass', 'status'] as const,
    massResults: (accountId: string | undefined, page: number) =>
      ['duplicates', accountId, 'mass', 'results', page] as const,
  },
};
