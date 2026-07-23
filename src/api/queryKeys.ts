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
  /**
   * Legacy Academy keys (pre-V2). Kept until cutover/cleanup so existing pages
   * keep working. Prefer queryKeys.academyV2 for new code.
   */
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
   * Academy V2 — single internal query tree. Prefer granular invalidation
   * over `academyV2.all` after mutations.
   */
  academyV2: {
    all: ['academy-v2'] as const,
    myLearning: ['academy-v2', 'my-learning'] as const,
    myEnrollments: (filters?: unknown) => ['academy-v2', 'my-enrollments', filters] as const,
    catalog: (filters?: unknown) => ['academy-v2', 'catalog', filters] as const,
    /**
     * Prefix-friendly list key: invalidate with queryKeys.academyV2.coursesRoot
     * so all filtered list queries refresh after mutations.
     */
    coursesRoot: ['academy-v2', 'courses'] as const,
    courses: (filters?: unknown) => ['academy-v2', 'courses', 'list', filters] as const,
    course: (courseId: ID | null | undefined) => ['academy-v2', 'course', courseId] as const,
    versions: (courseId: ID | null | undefined) => ['academy-v2', 'versions', courseId] as const,
    version: (courseId: ID | null | undefined, versionId: ID | null | undefined) =>
      ['academy-v2', 'version', courseId, versionId] as const,
    draft: (courseId: ID | null | undefined) => ['academy-v2', 'draft', courseId] as const,
    draftOutline: (draftVersionId: ID | null | undefined) =>
      ['academy-v2', 'draft-outline', draftVersionId] as const,
    templatesRoot: ['academy-v2', 'templates'] as const,
    templates: (filters?: unknown) =>
      ['academy-v2', 'templates', 'list', filters] as const,
    template: (templateId: ID | null | undefined) =>
      ['academy-v2', 'template', templateId] as const,
    partnerCourses: (partnerId: ID | null | undefined, filters?: unknown) =>
      ['academy-v2', 'partner-courses', partnerId, filters] as const,
    partners: (filters?: unknown) => ['academy-v2', 'partners', filters] as const,
    internalReport: (filters?: unknown) => ['academy-v2', 'internal-report', filters] as const,
    partnerExternalReport: (filters?: unknown) =>
      ['academy-v2', 'partner-external-report', filters] as const,
    externalLearners: (filters?: unknown) =>
      ['academy-v2', 'external-learners', filters] as const,
    externalLearner: (learnerId: ID | null | undefined) =>
      ['academy-v2', 'external-learner', learnerId] as const,
    personalAccesses: (courseId: ID | null | undefined, filters?: unknown) =>
      ['academy-v2', 'personal-accesses', courseId, filters] as const,
    campaigns: (courseId: ID | null | undefined, filters?: unknown) =>
      ['academy-v2', 'campaigns', courseId, filters] as const,
    campaignReport: (campaignId: ID | null | undefined) =>
      ['academy-v2', 'campaign-report', campaignId] as const,
    enrollment: (enrollmentId: ID | null | undefined) =>
      ['academy-v2', 'enrollment', enrollmentId] as const,
    enrollmentLesson: (
      enrollmentId: ID | null | undefined,
      lessonId: ID | null | undefined,
    ) => ['academy-v2', 'enrollment-lesson', enrollmentId, lessonId] as const,
    enrollmentReport: (enrollmentId: ID | null | undefined) =>
      ['academy-v2', 'enrollment-report', enrollmentId] as const,
    assignments: (courseId: ID | null | undefined) =>
      ['academy-v2', 'assignments', courseId] as const,
  },
  /** Public external player — short staleTime, never persist tokens. */
  externalAcademy: {
    all: ['external-academy'] as const,
    access: (token: string | null | undefined) => ['external-academy', 'access', token] as const,
    enrollment: (enrollmentId: ID | null | undefined) =>
      ['external-academy', 'enrollment', enrollmentId] as const,
    outline: (enrollmentId: ID | null | undefined) =>
      ['external-academy', 'outline', enrollmentId] as const,
    lesson: (enrollmentId: ID | null | undefined, lessonVersionId: ID | null | undefined) =>
      ['external-academy', 'lesson', enrollmentId, lessonVersionId] as const,
    results: (enrollmentId: ID | null | undefined) =>
      ['external-academy', 'results', enrollmentId] as const,
  },
  /**
   * Академия Opus — параллельная реализация раздела. Отдельное поддерево
   * ключей: данные те же, но набор запросов другой, и инвалидация одной
   * Академии не должна дёргать вторую.
   * @deprecated Remove after Academy V2 cutover (Phase 10).
   */
  academyOpus: {
    all: ['academy-opus'] as const,
    currentUser: ['academy-opus', 'current-user'] as const,
    users: ['academy-opus', 'users'] as const,
    positions: ['academy-opus', 'positions'] as const,
    departments: ['academy-opus', 'departments'] as const,
    courses: ['academy-opus', 'courses'] as const,
    course: (courseId: ID | null | undefined) => ['academy-opus', 'course', courseId] as const,
    sectionsFor: (courseId: ID | null | undefined) =>
      ['academy-opus', 'sections', courseId] as const,
    lessons: ['academy-opus', 'lessons'] as const,
    lessonsFor: (courseId: ID | null | undefined) => ['academy-opus', 'lessons', courseId] as const,
    quizzes: ['academy-opus', 'quizzes'] as const,
    progress: ['academy-opus', 'progress'] as const,
    progressFor: (courseId: ID | null | undefined) =>
      ['academy-opus', 'progress', courseId] as const,
    assignments: ['academy-opus', 'assignments'] as const,
    myAssignments: ['academy-opus', 'my-assignments'] as const,
    learnerRows: ['academy-opus', 'learner-rows'] as const,
    dropOff: (courseId: ID | null | undefined) => ['academy-opus', 'drop-off', courseId] as const,
  },
  /**
   * @deprecated Remove after Academy V2 cutover (Phase 10).
   */
  academyGrok: {
    all: ['academy-grok'] as const,
    currentUser: ['academy-grok', 'current-user'] as const,
    users: ['academy-grok', 'users'] as const,
    positions: ['academy-grok', 'positions'] as const,
    departments: ['academy-grok', 'departments'] as const,
    courses: ['academy-grok', 'courses'] as const,
    course: (courseId: ID | null | undefined) => ['academy-grok', 'course', courseId] as const,
    sectionsFor: (courseId: ID | null | undefined) =>
      ['academy-grok', 'sections', courseId] as const,
    lessons: ['academy-grok', 'lessons'] as const,
    lessonsFor: (courseId: ID | null | undefined) => ['academy-grok', 'lessons', courseId] as const,
    quizzes: ['academy-grok', 'quizzes'] as const,
    progress: ['academy-grok', 'progress'] as const,
    assignments: ['academy-grok', 'assignments'] as const,
    learnProgress: (courseId: ID | null | undefined) =>
      ['academy-grok', 'learn', 'progress', courseId] as const,
    learnLessons: (courseId: ID | null | undefined) =>
      ['academy-grok', 'learn', 'lessons', courseId] as const,
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
