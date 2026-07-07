/**
 * Функции запросов мок-API, сгруппированные по модулям.
 * Сигнатуры — контракт с будущим бэкендом: при его появлении меняются
 * только реализации (fetch вместо mockRequest), но не сигнатуры.
 */

import { ApiError, mockRequest, notFound } from './client';
import * as db from './fixtures';
import { canMoveDepartment } from '@/lib/orgTree';
import { validateInviteEmail } from '@/lib/inviteRules';
import { validateUserUpdate } from '@/lib/userGuards';
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
  CourseSection,
  Department,
  ID,
  Invite,
  Label,
  Lesson,
  Quiz,
  Position,
  ShiftException,
  Task,
  TaskColumn,
  TaskComment,
  TaskPriority,
  User,
  UserSchedule,
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

  updateCompany: (input: { name?: string; logoUrl?: string }): Promise<Company> =>
    mockRequest(() => {
      if (input.name !== undefined) db.company.name = input.name;
      if (input.logoUrl !== undefined) db.company.logoUrl = input.logoUrl || undefined;
      return db.company;
    }),

  updateCurrentUser: (input: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<User> =>
    mockRequest(() => {
      const user = db.users.find((u) => u.id === db.CURRENT_USER_ID) ?? notFound('Пользователь');
      if (input.firstName !== undefined) user.firstName = input.firstName;
      if (input.lastName !== undefined) user.lastName = input.lastName;
      if (input.phone !== undefined) user.phone = input.phone || undefined;
      if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl || undefined;
      return user;
    }),
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

  renameDepartment: (input: { id: ID; name: string }): Promise<Department> =>
    mockRequest(() => {
      const department = db.departments.find((d) => d.id === input.id) ?? notFound('Отдел');
      department.name = input.name;
      return department;
    }),

  deleteDepartment: (id: ID): Promise<void> =>
    mockRequest(() => {
      const hasChildren = db.departments.some((d) => d.parentId === id);
      const hasPositions = db.positions.some((p) => p.departmentId === id);
      if (hasChildren || hasPositions) {
        throw new ApiError(
          'Нельзя удалить отдел с вложенными отделами или должностями. Сначала переместите их.',
          400,
        );
      }
      const index = db.departments.findIndex((d) => d.id === id);
      if (index === -1) notFound('Отдел');
      db.departments.splice(index, 1);
    }),

  moveDepartment: (input: { id: ID; parentId: ID | null }): Promise<Department> =>
    mockRequest(() => {
      const validation = canMoveDepartment(db.departments, input.id, input.parentId);
      if (!validation.allowed) {
        throw new ApiError(validation.reason ?? 'Перемещение невозможно', 400);
      }
      const department = db.departments.find((d) => d.id === input.id)!;
      department.parentId = input.parentId;
      department.order = db.departments.filter(
        (d) => d.parentId === input.parentId && d.id !== input.id,
      ).length;
      return department;
    }),

  createPosition: (input: {
    name: string;
    departmentId: ID;
    level?: Position['level'];
    description?: string;
  }): Promise<Position> =>
    mockRequest(() => {
      const position: Position = {
        id: uid(),
        name: input.name,
        departmentId: input.departmentId,
        level: input.level ?? 0,
        description: input.description,
        articleIds: [],
        requiredCourseIds: [],
      };
      db.positions.push(position);
      return position;
    }),

  updatePosition: (input: {
    id: ID;
    name?: string;
    level?: Position['level'];
    description?: string;
  }): Promise<Position> =>
    mockRequest(() => {
      const position = db.positions.find((p) => p.id === input.id) ?? notFound('Должность');
      if (input.name !== undefined) position.name = input.name;
      if (input.level !== undefined) position.level = input.level;
      if (input.description !== undefined) position.description = input.description;
      return position;
    }),

  deletePosition: (id: ID): Promise<void> =>
    mockRequest(() => {
      const index = db.positions.findIndex((p) => p.id === id);
      if (index === -1) notFound('Должность');
      db.positions.splice(index, 1);
      // Снимаем должность с сотрудников, которые её занимали.
      db.users.forEach((user) => {
        user.positionIds = user.positionIds.filter((pid) => pid !== id);
      });
    }),

  movePosition: (input: { id: ID; departmentId: ID }): Promise<Position> =>
    mockRequest(() => {
      const position = db.positions.find((p) => p.id === input.id) ?? notFound('Должность');
      if (!db.departments.some((d) => d.id === input.departmentId)) notFound('Отдел');
      position.departmentId = input.departmentId;
      return position;
    }),

  getInvites: (): Promise<Invite[]> =>
    mockRequest(() => [...db.invites].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),

  inviteUser: (input: {
    /** Не задан для приглашения по ссылке. */
    email?: string;
    role: User['role'];
    positionId?: ID;
    departmentId?: ID;
  }): Promise<Invite> =>
    mockRequest(() => {
      if (input.email) {
        const inviteError = validateInviteEmail(input.email, db.users);
        if (inviteError) throw new ApiError(inviteError, 400);
      }

      const invite: Invite = {
        id: uid(),
        token: uid(),
        status: 'pending',
        invitedById: db.CURRENT_USER_ID,
        createdAt: now(),
        ...input,
      };
      db.invites.push(invite);

      if (input.email) {
        const normalized = input.email.trim().toLowerCase();
        const existing = db.users.find((u) => u.email.toLowerCase() === normalized);
        if (existing) {
          existing.role = input.role;
          existing.status = 'invited';
          existing.positionIds = input.positionId ? [input.positionId] : [];
        } else {
          const [local] = normalized.split('@');
          const firstName = local.split(/[._-]/)[0] ?? 'Новый';
          db.users.push({
            id: uid(),
            email: normalized,
            firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
            lastName: 'Сотрудник',
            role: input.role,
            status: 'invited',
            positionIds: input.positionId ? [input.positionId] : [],
            createdAt: now(),
          });
        }
      }

      return invite;
    }),

  createUser: (input: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: User['role'];
    positionIds?: ID[];
  }): Promise<User> =>
    mockRequest(() => {
      const email = input.email.trim().toLowerCase();
      if (!input.firstName.trim()) throw new ApiError('Укажите имя пользователя', 400);
      if (!input.lastName.trim()) throw new ApiError('Укажите фамилию пользователя', 400);
      if (!email) throw new ApiError('Укажите email пользователя', 400);
      if (db.users.some((user) => user.email.toLowerCase() === email)) {
        throw new ApiError('Пользователь с таким email уже существует', 400);
      }

      const user: User = {
        id: uid(),
        email,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() || undefined,
        role: input.role,
        status: 'active',
        positionIds: input.positionIds ?? [],
        createdAt: now(),
      };
      db.users.push(user);
      return user;
    }),

  resendInvite: (id: ID): Promise<Invite> =>
    mockRequest(() => {
      const invite = db.invites.find((i) => i.id === id) ?? notFound('Приглашение');
      if (invite.status !== 'pending') {
        throw new ApiError('Повторно отправить можно только ожидающие приглашения', 400);
      }
      invite.createdAt = now();
      return invite;
    }),

  revokeInvite: (id: ID): Promise<void> =>
    mockRequest(() => {
      const invite = db.invites.find((i) => i.id === id) ?? notFound('Приглашение');
      if (invite.status === 'accepted') {
        throw new ApiError('Нельзя отозвать принятое приглашение', 400);
      }
      invite.status = 'expired';
      if (invite.email) {
        const user = db.users.find(
          (u) => u.email.toLowerCase() === invite.email!.toLowerCase() && u.status === 'invited',
        );
        if (user) user.status = 'deactivated';
      }
    }),

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
  }): Promise<User> =>
    mockRequest(() => {
      const user = db.users.find((u) => u.id === input.id) ?? notFound('Сотрудник');
      const guardError = validateUserUpdate(
        user,
        { role: input.role, status: input.status },
        { ownerId: db.company.ownerId, currentUserId: db.CURRENT_USER_ID },
      );
      if (guardError) throw new ApiError(guardError, 400);

      if (input.firstName !== undefined) user.firstName = input.firstName.trim();
      if (input.lastName !== undefined) user.lastName = input.lastName.trim();
      if (input.phone !== undefined) user.phone = input.phone.trim() || undefined;
      if (input.birthDate !== undefined) user.birthDate = input.birthDate || undefined;
      if (input.hiredAt !== undefined) user.hiredAt = input.hiredAt || undefined;
      if (input.vacationAllowance !== undefined) user.vacationAllowance = input.vacationAllowance;
      if (input.role !== undefined) user.role = input.role;
      if (input.status !== undefined) user.status = input.status;
      if (input.positionIds !== undefined) user.positionIds = input.positionIds;

      return user;
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

  getAcknowledgements: (articleId: ID): Promise<typeof db.acknowledgements> =>
    mockRequest(() => db.acknowledgements.filter((a) => a.articleId === articleId)),

  createSection: (input: {
    name: string;
    parentId: ID | null;
    access?: ArticleSection['access'];
  }): Promise<ArticleSection> =>
    mockRequest(() => {
      const siblings = db.articleSections.filter((s) => s.parentId === input.parentId);
      const section: ArticleSection = {
        id: uid(),
        name: input.name,
        parentId: input.parentId,
        order: siblings.length,
        access: input.access ?? {
          scope: 'company',
          departmentIds: [],
          positionIds: [],
          userIds: [],
        },
      };
      db.articleSections.push(section);
      return section;
    }),

  updateSection: (input: {
    id: ID;
    name?: string;
    access?: ArticleSection['access'];
  }): Promise<ArticleSection> =>
    mockRequest(() => {
      const section = db.articleSections.find((s) => s.id === input.id) ?? notFound('Раздел');
      if (input.name !== undefined) section.name = input.name;
      if (input.access !== undefined) section.access = input.access;
      return section;
    }),

  deleteSection: (id: ID): Promise<void> =>
    mockRequest(() => {
      if (db.articleSections.some((s) => s.parentId === id)) {
        throw new ApiError('Нельзя удалить раздел с вложенными подразделами.', 400);
      }
      if (db.articles.some((a) => a.sectionId === id)) {
        throw new ApiError('Нельзя удалить раздел со статьями.', 400);
      }
      const index = db.articleSections.findIndex((s) => s.id === id);
      if (index === -1) notFound('Раздел');
      db.articleSections.splice(index, 1);
    }),

  createArticle: (input: {
    sectionId: ID;
    title: string;
    content: Article['content'];
    status: Article['status'];
    requiresAcknowledgement: boolean;
  }): Promise<Article> =>
    mockRequest(() => {
      const article: Article = {
        id: uid(),
        sectionId: input.sectionId,
        title: input.title,
        content: input.content,
        status: input.status,
        requiresAcknowledgement: input.requiresAcknowledgement,
        authorId: db.CURRENT_USER_ID,
        version: 1,
        createdAt: now(),
        updatedAt: now(),
      };
      db.articles.push(article);
      return article;
    }),

  updateArticle: (input: {
    id: ID;
    sectionId?: ID;
    title?: string;
    content?: Article['content'];
    status?: Article['status'];
    requiresAcknowledgement?: boolean;
  }): Promise<Article> =>
    mockRequest(() => {
      const article = db.articles.find((a) => a.id === input.id) ?? notFound('Статья');
      const contentChanged =
        input.content !== undefined || input.title !== undefined || input.status !== undefined;
      if (contentChanged) {
        db.articleVersions.push({
          id: uid(),
          articleId: article.id,
          version: article.version,
          title: article.title,
          content: article.content,
          authorId: db.CURRENT_USER_ID,
          createdAt: now(),
        });
        article.version += 1;
      }
      if (input.sectionId !== undefined) article.sectionId = input.sectionId;
      if (input.title !== undefined) article.title = input.title;
      if (input.content !== undefined) article.content = input.content;
      if (input.status !== undefined) article.status = input.status;
      if (input.requiresAcknowledgement !== undefined) {
        article.requiresAcknowledgement = input.requiresAcknowledgement;
      }
      article.updatedAt = now();
      return article;
    }),

  rollbackArticle: (input: { articleId: ID; versionId: ID }): Promise<Article> =>
    mockRequest(() => {
      const article = db.articles.find((a) => a.id === input.articleId) ?? notFound('Статья');
      const version =
        db.articleVersions.find((v) => v.id === input.versionId && v.articleId === input.articleId) ??
        notFound('Версия');
      db.articleVersions.push({
        id: uid(),
        articleId: article.id,
        version: article.version,
        title: article.title,
        content: article.content,
        authorId: db.CURRENT_USER_ID,
        createdAt: now(),
      });
      article.title = version.title;
      article.content = version.content;
      article.version += 1;
      article.updatedAt = now();
      return article;
    }),

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
      db.articles.filter((a) => {
        const normalized = query.toLowerCase();
        const body = JSON.stringify(a.content).toLowerCase();
        return a.title.toLowerCase().includes(normalized) || body.includes(normalized);
      }),
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

  createColumn: (input: { boardId: ID; name: string; color?: string }): Promise<TaskColumn> =>
    mockRequest(() => {
      const siblings = db.taskColumns.filter((c) => c.boardId === input.boardId);
      const column: TaskColumn = {
        id: uid(),
        boardId: input.boardId,
        name: input.name,
        color: input.color,
        order: siblings.length,
      };
      db.taskColumns.push(column);
      return column;
    }),

  updateColumn: (input: { id: ID; name?: string; color?: string }): Promise<TaskColumn> =>
    mockRequest(() => {
      const column = db.taskColumns.find((c) => c.id === input.id) ?? notFound('Колонка');
      if (input.name !== undefined) column.name = input.name;
      if (input.color !== undefined) column.color = input.color;
      return column;
    }),

  createTask: (input: {
    boardId: ID;
    columnId: ID;
    title: string;
    priority?: TaskPriority;
  }): Promise<Task> =>
    mockRequest(() => {
      const tasksInColumn = db.tasks.filter((t) => t.columnId === input.columnId);
      const task: Task = {
        id: uid(),
        boardId: input.boardId,
        columnId: input.columnId,
        order: tasksInColumn.length,
        title: input.title,
        authorId: db.CURRENT_USER_ID,
        assigneeIds: [db.CURRENT_USER_ID],
        watcherIds: [],
        priority: input.priority ?? 'medium',
        labelIds: [],
        checklist: [],
        attachments: [],
        linkedArticleIds: [],
        createdAt: now(),
        updatedAt: now(),
      };
      db.tasks.push(task);
      return task;
    }),

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
  }): Promise<Task> =>
    mockRequest(() => {
      const task = db.tasks.find((t) => t.id === input.id) ?? notFound('Задача');
      if (input.title !== undefined) task.title = input.title;
      if (input.description !== undefined) task.description = input.description;
      if (input.assigneeIds !== undefined) task.assigneeIds = input.assigneeIds;
      if (input.assigneePositionId !== undefined) task.assigneePositionId = input.assigneePositionId;
      if (input.watcherIds !== undefined) task.watcherIds = input.watcherIds;
      if (input.dueDate !== undefined) task.dueDate = input.dueDate || undefined;
      if (input.priority !== undefined) task.priority = input.priority;
      if (input.labelIds !== undefined) task.labelIds = input.labelIds;
      if (input.checklist !== undefined) task.checklist = input.checklist;
      if (input.attachments !== undefined) task.attachments = input.attachments;
      if (input.linkedArticleIds !== undefined) task.linkedArticleIds = input.linkedArticleIds;
      if (input.recurrence !== undefined) task.recurrence = input.recurrence;
      if (input.completedAt !== undefined) task.completedAt = input.completedAt || undefined;
      task.updatedAt = now();
      return task;
    }),

  moveTask: (input: { taskId: ID; columnId: ID; order: number }): Promise<Task> =>
    mockRequest(() => {
      const task = db.tasks.find((t) => t.id === input.taskId) ?? notFound('Задача');
      const oldColumnId = task.columnId;
      task.columnId = input.columnId;
      task.order = input.order;
      task.updatedAt = now();
      for (const columnId of new Set([oldColumnId, input.columnId])) {
        db.tasks
          .filter((t) => t.columnId === columnId && t.id !== task.id)
          .sort((a, b) => a.order - b.order)
          .forEach((sibling, index) => {
            sibling.order = columnId === input.columnId && index >= input.order ? index + 1 : index;
          });
      }
      return task;
    }),

  addComment: (input: { taskId: ID; content: TaskComment['content'] }): Promise<TaskComment> =>
    mockRequest(() => {
      const comment: TaskComment = {
        id: uid(),
        taskId: input.taskId,
        authorId: db.CURRENT_USER_ID,
        content: input.content,
        createdAt: now(),
      };
      db.taskComments.push(comment);
      return comment;
    }),
};

// ============================================================================
// Академия
// ============================================================================

/** Урок-«ссылка» всегда отдаёт актуальный контент статьи БЗ. */
function withLiveContent(lesson: Lesson): Lesson {
  if (lesson.sourceMode !== 'link' || !lesson.sourceArticleId) return lesson;
  const article = db.articles.find((a) => a.id === lesson.sourceArticleId);
  return article ? { ...lesson, content: article.content } : lesson;
}

/** Удаляет урок вместе с его тестом и отметками прохождения. */
function removeLessonCascade(lessonId: ID) {
  const index = db.lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) return;
  db.lessons.splice(index, 1);
  const quizIndex = db.quizzes.findIndex((q) => q.lessonId === lessonId);
  if (quizIndex !== -1) db.quizzes.splice(quizIndex, 1);
  db.courseProgress.forEach((progress) => {
    progress.completedLessonIds = progress.completedLessonIds.filter((id) => id !== lessonId);
  });
}

export const academyApi = {
  getCourses: (): Promise<Course[]> => mockRequest(() => db.courses),

  getCourse: (id: ID): Promise<Course> =>
    mockRequest(() => db.courses.find((c) => c.id === id) ?? notFound('Курс')),

  getLessons: (courseId?: ID): Promise<Lesson[]> =>
    mockRequest(() =>
      (courseId ? db.lessons.filter((l) => l.courseId === courseId) : db.lessons)
        .sort((a, b) => a.order - b.order)
        .map(withLiveContent),
    ),

  getCourseSections: (courseId: ID): Promise<CourseSection[]> =>
    mockRequest(() =>
      db.courseSections.filter((s) => s.courseId === courseId).sort((a, b) => a.order - b.order),
    ),

  getQuizzes: (lessonId?: ID): Promise<Quiz[]> =>
    mockRequest(() =>
      lessonId ? db.quizzes.filter((q) => q.lessonId === lessonId) : db.quizzes,
    ),

  createCourse: (input: {
    title: string;
    description?: string;
    status?: Course['status'];
    sequential?: boolean;
    deadlineDays?: number;
  }): Promise<Course> =>
    mockRequest(() => {
      const course: Course = {
        id: uid(),
        title: input.title,
        description: input.description,
        status: input.status ?? 'draft',
        sequential: input.sequential ?? true,
        deadlineDays: input.deadlineDays,
        authorId: db.CURRENT_USER_ID,
        createdAt: now(),
        updatedAt: now(),
      };
      db.courses.push(course);
      db.courseSections.push({
        id: uid(),
        courseId: course.id,
        title: 'Первый раздел',
        order: 0,
      });
      return course;
    }),

  /**
   * Создаёт курс на основе базы знаний: выбранные разделы БЗ становятся
   * разделами курса, их статьи — уроками (в режиме link или copy).
   */
  createCourseFromKb: (input: {
    title: string;
    description?: string;
    sequential?: boolean;
    deadlineDays?: number;
    /** Режим связи уроков со статьями: link — синхронизация, copy — независимая копия. */
    mode: NonNullable<Lesson['sourceMode']>;
    /** Разделы БЗ в порядке следования. */
    sectionIds: ID[];
    /** Статьи выбранных разделов, которые станут уроками. */
    articleIds: ID[];
  }): Promise<Course> =>
    mockRequest(() => {
      const selected = new Set(input.articleIds);
      const source = input.sectionIds
        .map((sectionId) => ({
          kbSection: db.articleSections.find((s) => s.id === sectionId),
          articles: db.articles.filter((a) => a.sectionId === sectionId && selected.has(a.id)),
        }))
        .filter((item) => item.kbSection && item.articles.length > 0);
      if (source.length === 0) {
        throw new ApiError('Выберите хотя бы одну статью для курса.', 400);
      }
      const course: Course = {
        id: uid(),
        title: input.title,
        description: input.description,
        status: 'draft',
        sequential: input.sequential ?? true,
        deadlineDays: input.deadlineDays,
        authorId: db.CURRENT_USER_ID,
        createdAt: now(),
        updatedAt: now(),
      };
      db.courses.push(course);
      source.forEach(({ kbSection, articles }, order) => {
        const section: CourseSection = {
          id: uid(),
          courseId: course.id,
          title: kbSection!.name,
          order,
        };
        db.courseSections.push(section);
        articles.forEach((article, lessonOrder) => {
          db.lessons.push({
            id: uid(),
            courseId: course.id,
            sectionId: section.id,
            title: article.title,
            order: lessonOrder,
            content: article.content,
            sourceArticleId: article.id,
            sourceMode: input.mode,
          });
        });
      });
      return course;
    }),

  updateCourse: (input: {
    id: ID;
    title?: string;
    description?: string;
    status?: Course['status'];
    sequential?: boolean;
    deadlineDays?: number;
  }): Promise<Course> =>
    mockRequest(() => {
      const course = db.courses.find((c) => c.id === input.id) ?? notFound('Курс');
      if (input.title !== undefined) course.title = input.title;
      if (input.description !== undefined) course.description = input.description;
      if (input.status !== undefined) course.status = input.status;
      if (input.sequential !== undefined) course.sequential = input.sequential;
      if (input.deadlineDays !== undefined) course.deadlineDays = input.deadlineDays || undefined;
      course.updatedAt = now();
      return course;
    }),

  deleteCourse: (id: ID): Promise<void> =>
    mockRequest(() => {
      const index = db.courses.findIndex((c) => c.id === id);
      if (index === -1) notFound('Курс');
      db.courses.splice(index, 1);
      db.lessons
        .filter((l) => l.courseId === id)
        .map((l) => l.id)
        .forEach(removeLessonCascade);
      for (let i = db.courseSections.length - 1; i >= 0; i--) {
        if (db.courseSections[i].courseId === id) db.courseSections.splice(i, 1);
      }
      for (let i = db.courseAssignments.length - 1; i >= 0; i--) {
        if (db.courseAssignments[i].courseId === id) db.courseAssignments.splice(i, 1);
      }
      for (let i = db.courseProgress.length - 1; i >= 0; i--) {
        if (db.courseProgress[i].courseId === id) db.courseProgress.splice(i, 1);
      }
      db.positions.forEach((position) => {
        position.requiredCourseIds = position.requiredCourseIds.filter((cid) => cid !== id);
      });
    }),

  createCourseSection: (input: { courseId: ID; title: string }): Promise<CourseSection> =>
    mockRequest(() => {
      const siblings = db.courseSections.filter((s) => s.courseId === input.courseId);
      const section: CourseSection = {
        id: uid(),
        courseId: input.courseId,
        title: input.title,
        order: siblings.length,
      };
      db.courseSections.push(section);
      return section;
    }),

  updateCourseSection: (input: { id: ID; title: string }): Promise<CourseSection> =>
    mockRequest(() => {
      const section = db.courseSections.find((s) => s.id === input.id) ?? notFound('Раздел курса');
      section.title = input.title;
      return section;
    }),

  deleteCourseSection: (id: ID): Promise<void> =>
    mockRequest(() => {
      const index = db.courseSections.findIndex((s) => s.id === id);
      if (index === -1) notFound('Раздел курса');
      db.lessons
        .filter((l) => l.sectionId === id)
        .map((l) => l.id)
        .forEach(removeLessonCascade);
      db.courseSections.splice(index, 1);
    }),

  createLesson: (input: {
    courseId: ID;
    sectionId: ID;
    title: string;
    content?: Lesson['content'];
    sourceArticleId?: ID;
    sourceMode?: Lesson['sourceMode'];
  }): Promise<Lesson> =>
    mockRequest(() => {
      const siblings = db.lessons.filter((l) => l.sectionId === input.sectionId);
      const sourceArticle = input.sourceArticleId
        ? db.articles.find((a) => a.id === input.sourceArticleId)
        : undefined;
      const lesson: Lesson = {
        id: uid(),
        courseId: input.courseId,
        sectionId: input.sectionId,
        title: input.title,
        order: siblings.length,
        content:
          input.sourceMode === 'link' && sourceArticle
            ? sourceArticle.content
            : (input.content ?? sourceArticle?.content ?? db.richText('Новый урок')),
        sourceArticleId: input.sourceArticleId,
        sourceMode: input.sourceMode,
      };
      db.lessons.push(lesson);
      return lesson;
    }),

  updateLesson: (input: {
    id: ID;
    title?: string;
    content?: Lesson['content'];
    sourceArticleId?: ID;
    sourceMode?: Lesson['sourceMode'];
  }): Promise<Lesson> =>
    mockRequest(() => {
      const lesson = db.lessons.find((l) => l.id === input.id) ?? notFound('Урок');
      const sourceArticle = input.sourceArticleId
        ? db.articles.find((a) => a.id === input.sourceArticleId)
        : undefined;
      if (input.title !== undefined) lesson.title = input.title;
      if (input.sourceArticleId !== undefined) lesson.sourceArticleId = input.sourceArticleId;
      if (input.sourceMode !== undefined) lesson.sourceMode = input.sourceMode;
      if (lesson.sourceMode === 'link' && sourceArticle) lesson.content = sourceArticle.content;
      else if (input.sourceArticleId !== undefined && sourceArticle && input.content === undefined) {
        lesson.content = sourceArticle.content;
      }
      else if (input.content !== undefined) lesson.content = input.content;
      return lesson;
    }),

  deleteLesson: (id: ID): Promise<void> =>
    mockRequest(() => {
      if (!db.lessons.some((l) => l.id === id)) notFound('Урок');
      removeLessonCascade(id);
    }),

  moveLesson: (input: { id: ID; sectionId: ID; order: number }): Promise<Lesson> =>
    mockRequest(() => {
      const lesson = db.lessons.find((l) => l.id === input.id) ?? notFound('Урок');
      lesson.sectionId = input.sectionId;
      lesson.order = input.order;
      db.lessons
        .filter((l) => l.sectionId === input.sectionId && l.id !== lesson.id)
        .sort((a, b) => a.order - b.order)
        .forEach((sibling, index) => {
          sibling.order = index >= input.order ? index + 1 : index;
        });
      return lesson;
    }),

  upsertQuiz: (input: Omit<Quiz, 'id'> & { id?: ID }): Promise<Quiz> =>
    mockRequest(() => {
      if (input.id) {
        const quiz = db.quizzes.find((q) => q.id === input.id) ?? notFound('Тест');
        quiz.questions = input.questions;
        quiz.passingScore = input.passingScore;
        quiz.maxAttempts = input.maxAttempts;
        return quiz;
      }
      const quiz: Quiz = {
        id: uid(),
        lessonId: input.lessonId,
        questions: input.questions,
        passingScore: input.passingScore,
        maxAttempts: input.maxAttempts,
      };
      db.quizzes.push(quiz);
      const lesson = db.lessons.find((l) => l.id === input.lessonId);
      if (lesson) lesson.quizId = quiz.id;
      return quiz;
    }),

  getAssignments: (): Promise<CourseAssignment[]> => mockRequest(() => db.courseAssignments),

  assignCourse: (input: {
    courseId: ID;
    assigneeType: CourseAssignment['assigneeType'];
    assigneeId?: ID;
    dueDate?: string;
  }): Promise<CourseAssignment> =>
    mockRequest(() => {
      const assignment: CourseAssignment = {
        id: uid(),
        courseId: input.courseId,
        assigneeType: input.assigneeType,
        assigneeId: input.assigneeId || undefined,
        inviteToken: input.assigneeType === 'external' ? uid() : undefined,
        dueDate: input.dueDate || undefined,
        assignedById: db.CURRENT_USER_ID,
        createdAt: now(),
      };
      db.courseAssignments.push(assignment);
      return assignment;
    }),

  getProgress: (courseId?: ID): Promise<CourseProgress[]> =>
    mockRequest(() =>
      courseId ? db.courseProgress.filter((p) => p.courseId === courseId) : db.courseProgress,
    ),

  markLessonComplete: (input: { courseId: ID; lessonId: ID; userId?: ID }): Promise<CourseProgress> =>
    mockRequest(() => {
      const userId = input.userId ?? db.CURRENT_USER_ID;
      let progress = db.courseProgress.find(
        (p) => p.courseId === input.courseId && p.userId === userId,
      );
      if (!progress) {
        progress = {
          userId,
          courseId: input.courseId,
          status: 'in_progress',
          completedLessonIds: [],
          quizAttempts: [],
          startedAt: now(),
        };
        db.courseProgress.push(progress);
      }
      if (!progress.completedLessonIds.includes(input.lessonId)) {
        progress.completedLessonIds.push(input.lessonId);
      }
      const courseLessons = db.lessons.filter((lesson) => lesson.courseId === input.courseId);
      if (courseLessons.every((lesson) => progress!.completedLessonIds.includes(lesson.id))) {
        progress.status = 'completed';
        progress.completedAt = now();
      } else {
        progress.status = 'in_progress';
      }
      return progress;
    }),
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

// ============================================================================
// График работы
// ============================================================================

export const scheduleApi = {
  getSchedules: (): Promise<UserSchedule[]> => mockRequest(() => db.schedules),

  saveSchedule: (input: UserSchedule): Promise<UserSchedule> =>
    mockRequest(() => {
      const index = db.schedules.findIndex((schedule) => schedule.userId === input.userId);
      if (index >= 0) db.schedules[index] = input;
      else db.schedules.push(input);
      return input;
    }),

  /** Правки за месяц (month в формате YYYY-MM). */
  getExceptions: (month: string): Promise<ShiftException[]> =>
    mockRequest(() => db.shiftExceptions.filter((e) => e.date.startsWith(month))),

  /** Пакетное сохранение правок (публикация черновика): upsert по (userId, date). */
  saveExceptions: (inputs: Array<Omit<ShiftException, 'id'>>): Promise<ShiftException[]> =>
    mockRequest(() => {
      for (const input of inputs) {
        const index = db.shiftExceptions.findIndex(
          (e) => e.userId === input.userId && e.date === input.date,
        );
        if (index >= 0) db.shiftExceptions.splice(index, 1);
        db.shiftExceptions.push({ id: uid(), ...input });
      }
      return db.shiftExceptions;
    }),
};
