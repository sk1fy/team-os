/**
 * Функции запросов мок-API, сгруппированные по модулям.
 * Сигнатуры — контракт с будущим бэкендом: при его появлении меняются
 * только реализации (fetch вместо mockRequest), но не сигнатуры.
 */

import { mockRequest, notFound } from './client';
import * as db from './fixtures';
import type {
  AppNotification,
  Article,
  ArticleSection,
  ArticleVersion,
  Board,
  Company,
  Course,
  CourseAssignment,
  CourseProgress,
  Department,
  ID,
  Invite,
  Label,
  Lesson,
  Position,
  Task,
  TaskColumn,
  TaskComment,
  User,
} from '@/types';

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ============================================================================
// Аутентификация и компания (пока моки без реальной авторизации)
// ============================================================================

export const authApi = {
  getCurrentUser: (): Promise<User> =>
    mockRequest(
      () => db.users.find((u) => u.id === db.CURRENT_USER_ID) ?? notFound('Пользователь'),
      { noFail: true },
    ),

  getCompany: (): Promise<Company> => mockRequest(() => db.company, { noFail: true }),

  getInviteByToken: (token: string): Promise<Invite> =>
    mockRequest(() => db.invites.find((i) => i.token === token) ?? notFound('Приглашение')),
};

// ============================================================================
// Оргструктура
// ============================================================================

export const orgApi = {
  getDepartments: (): Promise<Department[]> => mockRequest(() => db.departments),

  getPositions: (): Promise<Position[]> => mockRequest(() => db.positions),

  getPosition: (id: ID): Promise<Position> =>
    mockRequest(() => db.positions.find((p) => p.id === id) ?? notFound('Должность')),

  getUsers: (): Promise<User[]> => mockRequest(() => db.users),

  getUser: (id: ID): Promise<User> =>
    mockRequest(() => db.users.find((u) => u.id === id) ?? notFound('Сотрудник')),

  createDepartment: (input: {
    name: string;
    parentId: ID | null;
  }): Promise<Department> =>
    mockRequest(() => {
      const siblings = db.departments.filter((d) => d.parentId === input.parentId);
      const department: Department = {
        id: uid(),
        name: input.name,
        parentId: input.parentId,
        order: siblings.length,
      };
      db.departments.push(department);
      return department;
    }),

  inviteUser: (input: {
    email: string;
    role: User['role'];
    positionId?: ID;
    departmentId?: ID;
  }): Promise<Invite> =>
    mockRequest(() => {
      const invite: Invite = {
        id: uid(),
        token: uid(),
        status: 'pending',
        invitedById: db.CURRENT_USER_ID,
        createdAt: now(),
        ...input,
      };
      db.invites.push(invite);
      return invite;
    }),
};

// ============================================================================
// База знаний
// ============================================================================

export const kbApi = {
  getSections: (): Promise<ArticleSection[]> => mockRequest(() => db.articleSections),

  getArticles: (sectionId?: ID): Promise<Article[]> =>
    mockRequest(() =>
      sectionId ? db.articles.filter((a) => a.sectionId === sectionId) : db.articles,
    ),

  getArticle: (id: ID): Promise<Article> =>
    mockRequest(() => db.articles.find((a) => a.id === id) ?? notFound('Статья')),

  getArticleVersions: (articleId: ID): Promise<ArticleVersion[]> =>
    mockRequest(() => db.articleVersions.filter((v) => v.articleId === articleId)),

  acknowledgeArticle: (articleId: ID): Promise<void> =>
    mockRequest(() => {
      db.acknowledgements.push({
        articleId,
        userId: db.CURRENT_USER_ID,
        acknowledgedAt: now(),
      });
    }),

  searchArticles: (query: string): Promise<Article[]> =>
    mockRequest(() =>
      db.articles.filter((a) => a.title.toLowerCase().includes(query.toLowerCase())),
    ),
};

// ============================================================================
// Таск-трекер
// ============================================================================

export const tasksApi = {
  getBoards: (): Promise<Board[]> => mockRequest(() => db.boards),

  getColumns: (boardId: ID): Promise<TaskColumn[]> =>
    mockRequest(() =>
      db.taskColumns.filter((c) => c.boardId === boardId).sort((a, b) => a.order - b.order),
    ),

  getTasks: (boardId?: ID): Promise<Task[]> =>
    mockRequest(() => (boardId ? db.tasks.filter((t) => t.boardId === boardId) : db.tasks)),

  getTask: (id: ID): Promise<Task> =>
    mockRequest(() => db.tasks.find((t) => t.id === id) ?? notFound('Задача')),

  getComments: (taskId: ID): Promise<TaskComment[]> =>
    mockRequest(() => db.taskComments.filter((c) => c.taskId === taskId)),

  getLabels: (): Promise<Label[]> => mockRequest(() => db.labels),

  moveTask: (input: { taskId: ID; columnId: ID; order: number }): Promise<Task> =>
    mockRequest(() => {
      const task = db.tasks.find((t) => t.id === input.taskId) ?? notFound('Задача');
      task.columnId = input.columnId;
      task.order = input.order;
      task.updatedAt = now();
      return task;
    }),
};

// ============================================================================
// Академия
// ============================================================================

export const academyApi = {
  getCourses: (): Promise<Course[]> => mockRequest(() => db.courses),

  getCourse: (id: ID): Promise<Course> =>
    mockRequest(() => db.courses.find((c) => c.id === id) ?? notFound('Курс')),

  getLessons: (courseId: ID): Promise<Lesson[]> =>
    mockRequest(() => db.lessons.filter((l) => l.courseId === courseId)),

  getAssignments: (): Promise<CourseAssignment[]> => mockRequest(() => db.courseAssignments),

  getProgress: (courseId?: ID): Promise<CourseProgress[]> =>
    mockRequest(() =>
      courseId ? db.courseProgress.filter((p) => p.courseId === courseId) : db.courseProgress,
    ),
};

// ============================================================================
// Уведомления
// ============================================================================

export const notificationsApi = {
  getNotifications: (): Promise<AppNotification[]> =>
    mockRequest(() => db.notifications.filter((n) => n.userId === db.CURRENT_USER_ID)),

  getUnreadCount: (): Promise<number> =>
    mockRequest(
      () => db.notifications.filter((n) => n.userId === db.CURRENT_USER_ID && !n.read).length,
      { noFail: true },
    ),

  markRead: (id: ID): Promise<void> =>
    mockRequest(() => {
      const notification = db.notifications.find((n) => n.id === id);
      if (notification) notification.read = true;
    }),

  markAllRead: (): Promise<void> =>
    mockRequest(() => {
      db.notifications.forEach((n) => {
        if (n.userId === db.CURRENT_USER_ID) n.read = true;
      });
    }),
};
