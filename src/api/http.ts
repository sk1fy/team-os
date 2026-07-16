import { httpRequest, jsonBody, refreshAccessToken, type AuthSession } from './client';
import { useAuthStore } from '@/stores/auth';
import type {
  Acknowledgement,
  AppNotification,
  Article,
  ArticleSection,
  ArticleVersion,
  Board,
  Company,
  Course,
  CourseAssignment,
  CourseProgress,
  CourseSection,
  DealDistributionGroup,
  Department,
  DistributionEvent,
  ID,
  Invite,
  Label,
  Lesson,
  Position,
  Quiz,
  ShiftException,
  Task,
  TaskColumn,
  TaskComment,
  TaskPriority,
  User,
  UserSchedule,
} from '@/types';

const id = (value: string) => encodeURIComponent(value);

function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  return httpRequest<T>(path, {
    method,
    body: body === undefined ? undefined : jsonBody(body),
  });
}

function publicRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  return httpRequest<T>(
    path,
    { method, body: body === undefined ? undefined : jsonBody(body) },
    { skipAuthRefresh: true },
  );
}

function rememberSession(session: AuthSession<User>): AuthSession<User> {
  useAuthStore.getState().setAccessToken(session.accessToken);
  useAuthStore.getState().setInitialized(true);
  return session;
}

export const httpAuthApi = {
  getCurrentUser: (): Promise<User> => request('/auth/me'),
  getCompany: (): Promise<Company> => request('/company'),
  getInviteByToken: (token: string): Promise<Invite> => publicRequest(`/auth/invites/${id(token)}`),
  updateCompany: (input: { name?: string; logoUrl?: string; amoAccountId?: string }): Promise<Company> =>
    request('/company', 'PATCH', input),
  updateCurrentUser: (input: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<User> => request('/auth/me', 'PATCH', input),
  login: async (input: { email: string; password: string }): Promise<AuthSession<User>> =>
    rememberSession(await publicRequest('/auth/login', 'POST', input)),
  refresh: async (): Promise<boolean> => refreshAccessToken<User>(),
  logout: async (): Promise<void> => {
    try {
      await httpRequest<void>('/auth/logout', { method: 'POST' }, { skipAuthRefresh: true });
    } finally {
      useAuthStore.getState().clear();
    }
  },
  register: async (input: {
    companyName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<AuthSession<User>> =>
    rememberSession(await publicRequest('/auth/register', 'POST', input)),
  acceptInvite: async (
    token: string,
    input: { email?: string; firstName: string; lastName: string; password: string },
  ): Promise<AuthSession<User>> =>
    rememberSession(await publicRequest(`/auth/invites/${id(token)}/accept`, 'POST', input)),
};

export const httpOrgApi = {
  getDepartments: (): Promise<Department[]> => request('/org/departments'),
  getPositions: (): Promise<Position[]> => request('/org/positions'),
  getPosition: (positionId: ID): Promise<Position> => request(`/org/positions/${id(positionId)}`),
  getUsers: (): Promise<User[]> => request('/org/users'),
  getUser: (userId: ID): Promise<User> => request(`/org/users/${id(userId)}`),
  createDepartment: (input: {
    name: string;
    parentId: ID | null;
    headUserId?: ID;
    valuableFinalProduct?: string;
  }): Promise<Department> => request('/org/departments', 'POST', input),
  updateDepartment: (input: {
    id: ID;
    name?: string;
    headUserId?: ID | null;
    valuableFinalProduct?: string | null;
  }): Promise<Department> => {
    const { id: departmentId, ...body } = input;
    return request(`/org/departments/${id(departmentId)}`, 'PATCH', body);
  },
  deleteDepartment: (departmentId: ID): Promise<void> =>
    request(`/org/departments/${id(departmentId)}`, 'DELETE'),
  moveDepartment: (input: { id: ID; parentId: ID | null }): Promise<Department> =>
    request(`/org/departments/${id(input.id)}/move`, 'POST', { parentId: input.parentId }),
  createPosition: (input: {
    name: string;
    departmentId: ID;
    level?: Position['level'];
    description?: string;
  }): Promise<Position> => request('/org/positions', 'POST', input),
  updatePosition: (input: {
    id: ID;
    name?: string;
    departmentId?: ID;
    level?: Position['level'];
    description?: string;
  }): Promise<Position> => {
    const { id: positionId, ...body } = input;
    return request(`/org/positions/${id(positionId)}`, 'PATCH', body);
  },
  deletePosition: (positionId: ID): Promise<void> =>
    request(`/org/positions/${id(positionId)}`, 'DELETE'),
  movePosition: (input: { id: ID; departmentId: ID }): Promise<Position> =>
    request(`/org/positions/${id(input.id)}/move`, 'POST', { departmentId: input.departmentId }),
  getInvites: (): Promise<Invite[]> => request('/org/invites'),
  inviteUser: (input: {
    email?: string;
    role: User['role'];
    positionId?: ID;
    departmentId?: ID;
  }): Promise<Invite> => request('/org/invites', 'POST', input),
  createUser: (input: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: User['role'];
    positionIds?: ID[];
  }): Promise<User> => request('/org/users', 'POST', input),
  resendInvite: (inviteId: ID): Promise<Invite> =>
    request(`/org/invites/${id(inviteId)}/resend`, 'POST'),
  revokeInvite: (inviteId: ID): Promise<void> =>
    request(`/org/invites/${id(inviteId)}/revoke`, 'POST'),
  deleteUser: (userId: ID): Promise<void> =>
    request(`/org/users/${id(userId)}`, 'DELETE'),
  updateUser: (input: {
    id: ID;
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: string;
    hiredAt?: string;
    vacationAllowance?: number;
    role?: User['role'];
    status?: User['status'];
    positionIds?: ID[];
  }): Promise<User> => {
    const { id: userId, ...body } = input;
    return request(`/org/users/${id(userId)}`, 'PATCH', body);
  },
};

export const httpKbApi = {
  getSections: (): Promise<ArticleSection[]> => request('/kb/sections'),
  getArticles: (sectionId?: ID): Promise<Article[]> =>
    request(`/kb/articles${sectionId ? `?sectionId=${id(sectionId)}` : ''}`),
  getArticle: (articleId: ID): Promise<Article> => request(`/kb/articles/${id(articleId)}`),
  getArticleVersions: (articleId: ID): Promise<ArticleVersion[]> =>
    request(`/kb/articles/${id(articleId)}/versions`),
  getAcknowledgements: (articleId: ID): Promise<Acknowledgement[]> =>
    request(`/kb/articles/${id(articleId)}/acknowledgements`),
  createSection: (input: {
    name: string;
    parentId: ID | null;
    access?: ArticleSection['access'];
  }): Promise<ArticleSection> => request('/kb/sections', 'POST', input),
  updateSection: (input: {
    id: ID;
    name?: string;
    access?: ArticleSection['access'];
  }): Promise<ArticleSection> => {
    const { id: sectionId, ...body } = input;
    return request(`/kb/sections/${id(sectionId)}`, 'PATCH', body);
  },
  deleteSection: (sectionId: ID): Promise<void> =>
    request(`/kb/sections/${id(sectionId)}`, 'DELETE'),
  createArticle: (input: {
    sectionId: ID;
    title: string;
    content: Article['content'];
    status: Article['status'];
    requiresAcknowledgement: boolean;
  }): Promise<Article> => request('/kb/articles', 'POST', input),
  updateArticle: (input: {
    id: ID;
    sectionId?: ID;
    title?: string;
    content?: Article['content'];
    status?: Article['status'];
    requiresAcknowledgement?: boolean;
  }): Promise<Article> => {
    const { id: articleId, ...body } = input;
    return request(`/kb/articles/${id(articleId)}`, 'PATCH', body);
  },
  rollbackArticle: (input: { articleId: ID; versionId: ID }): Promise<Article> =>
    request(`/kb/articles/${id(input.articleId)}/rollback`, 'POST', { versionId: input.versionId }),
  acknowledgeArticle: (articleId: ID): Promise<void> =>
    request(`/kb/articles/${id(articleId)}/acknowledge`, 'POST'),
  searchArticles: (query: string): Promise<Article[]> =>
    request(`/kb/articles/search?q=${encodeURIComponent(query)}`),
};

export const httpTasksApi = {
  getBoards: (): Promise<Board[]> => request('/tasks/boards'),
  getColumns: (boardId: ID): Promise<TaskColumn[]> =>
    request(`/tasks/boards/${id(boardId)}/columns`),
  getTasks: (boardId?: ID): Promise<Task[]> =>
    request(`/tasks${boardId ? `?boardId=${id(boardId)}` : ''}`),
  getTask: (taskId: ID): Promise<Task> => request(`/tasks/${id(taskId)}`),
  getComments: (taskId: ID): Promise<TaskComment[]> => request(`/tasks/${id(taskId)}/comments`),
  getLabels: (): Promise<Label[]> => request('/tasks/labels'),
  createColumn: (input: { boardId: ID; name: string; color?: string }): Promise<TaskColumn> => {
    const { boardId, ...body } = input;
    return request(`/tasks/boards/${id(boardId)}/columns`, 'POST', body);
  },
  updateColumn: (input: { id: ID; name?: string; color?: string }): Promise<TaskColumn> => {
    const { id: columnId, ...body } = input;
    return request(`/tasks/columns/${id(columnId)}`, 'PATCH', body);
  },
  createTask: (input: {
    boardId: ID;
    columnId: ID;
    title: string;
    priority?: TaskPriority;
  }): Promise<Task> => request('/tasks', 'POST', input),
  updateTask: (input: {
    id: ID;
    title?: string;
    description?: Task['description'];
    assigneeIds?: ID[];
    assigneePositionId?: ID;
    watcherIds?: ID[];
    dueDate?: ID;
    priority?: TaskPriority;
    labelIds?: ID[];
    checklist?: Task['checklist'];
    attachments?: Task['attachments'];
    linkedArticleIds?: ID[];
    recurrence?: Task['recurrence'];
    completedAt?: ID;
  }): Promise<Task> => {
    const { id: taskId, ...body } = input;
    return request(`/tasks/${id(taskId)}`, 'PATCH', body);
  },
  moveTask: (input: { taskId: ID; columnId: ID; order: number }): Promise<Task> =>
    request(`/tasks/${id(input.taskId)}/move`, 'POST', {
      columnId: input.columnId,
      order: input.order,
    }),
  addComment: (input: { taskId: ID; content: TaskComment['content'] }): Promise<TaskComment> =>
    request(`/tasks/${id(input.taskId)}/comments`, 'POST', { content: input.content }),
};

export const httpAcademyApi = {
  getCourses: (): Promise<Course[]> => request('/academy/courses'),
  getCourse: (courseId: ID): Promise<Course> => request(`/academy/courses/${id(courseId)}`),
  getLessons: (courseId?: ID): Promise<Lesson[]> =>
    request(`/academy/lessons${courseId ? `?courseId=${id(courseId)}` : ''}`),
  getCourseSections: (courseId: ID): Promise<CourseSection[]> =>
    request(`/academy/courses/${id(courseId)}/sections`),
  getQuizzes: (lessonId?: ID): Promise<Quiz[]> =>
    request(`/academy/quizzes${lessonId ? `?lessonId=${id(lessonId)}` : ''}`),
  createCourse: (input: {
    title: string;
    description?: string;
    status?: Course['status'];
    sequential?: boolean;
    deadlineDays?: number;
  }): Promise<Course> => request('/academy/courses', 'POST', input),
  createCourseFromKb: (input: {
    title: string;
    description?: string;
    sequential?: boolean;
    deadlineDays?: number;
    mode: NonNullable<Lesson['sourceMode']>;
    sectionIds: ID[];
    articleIds: ID[];
  }): Promise<Course> => request('/academy/courses/from-kb', 'POST', input),
  updateCourse: (input: {
    id: ID;
    title?: string;
    description?: string;
    status?: Course['status'];
    sequential?: boolean;
    deadlineDays?: number;
  }): Promise<Course> => {
    const { id: courseId, ...body } = input;
    return request(`/academy/courses/${id(courseId)}`, 'PATCH', body);
  },
  deleteCourse: (courseId: ID): Promise<void> =>
    request(`/academy/courses/${id(courseId)}`, 'DELETE'),
  createCourseSection: (input: { courseId: ID; title: string }): Promise<CourseSection> =>
    request(`/academy/courses/${id(input.courseId)}/sections`, 'POST', { title: input.title }),
  updateCourseSection: (input: { id: ID; title: string }): Promise<CourseSection> =>
    request(`/academy/sections/${id(input.id)}`, 'PATCH', { title: input.title }),
  deleteCourseSection: (sectionId: ID): Promise<void> =>
    request(`/academy/sections/${id(sectionId)}`, 'DELETE'),
  createLesson: (input: {
    courseId: ID;
    sectionId: ID;
    title: string;
    content?: Lesson['content'];
    sourceArticleId?: ID;
    sourceMode?: Lesson['sourceMode'];
  }): Promise<Lesson> => request('/academy/lessons', 'POST', input),
  updateLesson: (input: {
    id: ID;
    title?: string;
    content?: Lesson['content'];
    sourceArticleId?: ID;
    sourceMode?: Lesson['sourceMode'];
  }): Promise<Lesson> => {
    const { id: lessonId, ...body } = input;
    return request(`/academy/lessons/${id(lessonId)}`, 'PATCH', body);
  },
  deleteLesson: (lessonId: ID): Promise<void> =>
    request(`/academy/lessons/${id(lessonId)}`, 'DELETE'),
  moveLesson: (input: { id: ID; sectionId: ID; order: number }): Promise<Lesson> =>
    request(`/academy/lessons/${id(input.id)}/move`, 'POST', {
      sectionId: input.sectionId,
      order: input.order,
    }),
  upsertQuiz: (input: Omit<Quiz, 'id'> & { id?: ID }): Promise<Quiz> =>
    request('/academy/quizzes', 'PUT', input),
  getAssignments: (): Promise<CourseAssignment[]> => request('/academy/assignments'),
  assignCourse: (input: {
    courseId: ID;
    assigneeType: CourseAssignment['assigneeType'];
    assigneeId?: ID;
    dueDate?: string;
  }): Promise<CourseAssignment> => request('/academy/assignments', 'POST', input),
  getProgress: (courseId?: ID): Promise<CourseProgress[]> =>
    request(`/academy/progress${courseId ? `?courseId=${id(courseId)}` : ''}`),
  markLessonComplete: (input: {
    courseId: ID;
    lessonId: ID;
    userId?: ID;
  }): Promise<CourseProgress> =>
    request(`/academy/progress/lessons/${id(input.lessonId)}/complete`, 'POST', {
      courseId: input.courseId,
      userId: input.userId,
    }),
};

export const httpNotificationsApi = {
  getNotifications: (): Promise<AppNotification[]> => request('/notifications'),
  getUnreadCount: (): Promise<number> => request('/notifications/unread-count'),
  markRead: (notificationId: ID): Promise<void> =>
    request(`/notifications/${id(notificationId)}/read`, 'POST'),
  markAllRead: (): Promise<void> => request('/notifications/read-all', 'POST'),
};

export const httpScheduleApi = {
  getSchedules: (): Promise<UserSchedule[]> => request('/schedule'),
  saveSchedule: (input: UserSchedule): Promise<UserSchedule> =>
    request(`/schedule/${id(input.userId)}`, 'PUT', { template: input.template }),
  getExceptions: (month: string): Promise<ShiftException[]> =>
    request(`/schedule/exceptions?month=${encodeURIComponent(month)}`),
  saveExceptions: (inputs: Array<Omit<ShiftException, 'id'>>): Promise<ShiftException[]> =>
    request('/schedule/exceptions', 'PUT', inputs),
};

export const httpDistributionApi = {
  getGroups: (): Promise<DealDistributionGroup[]> => request('/distribution/groups'),
  createGroup: (input: {
    name: string;
    description?: string;
    memberIds: ID[];
  }): Promise<DealDistributionGroup> => request('/distribution/groups', 'POST', input),
  updateGroup: (input: {
    id: ID;
    name?: string;
    description?: string;
    active?: boolean;
    algorithm?: DealDistributionGroup['algorithm'];
    memberIds?: ID[];
    disabledMemberIds?: ID[];
    source?: string;
    dealLimit?: number;
    unclaimedMinutes?: number;
  }): Promise<DealDistributionGroup> => {
    const { id: groupId, ...body } = input;
    return request(`/distribution/groups/${id(groupId)}`, 'PATCH', body);
  },
  deleteGroup: (groupId: ID): Promise<void> =>
    request(`/distribution/groups/${id(groupId)}`, 'DELETE'),
  getEvents: (groupId: ID): Promise<DistributionEvent[]> =>
    request(`/distribution/groups/${id(groupId)}/events`),
  simulateDeal: (groupId: ID): Promise<DistributionEvent> =>
    request(`/distribution/groups/${id(groupId)}/simulate`, 'POST'),
  resetEvents: (groupId: ID): Promise<void> =>
    request(`/distribution/groups/${id(groupId)}/events`, 'DELETE'),
};
