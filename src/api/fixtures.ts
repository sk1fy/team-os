/**
 * Фикстуры — in-memory «база данных» мок-API.
 * Мутации из src/api/* изменяют эти массивы, поэтому в рамках сессии
 * данные ведут себя как настоящие (создал отдел — он появился в дереве).
 */

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
  Department,
  DealDistributionGroup,
  DistributionEvent,
  Invite,
  Label,
  Lesson,
  Position,
  Quiz,
  RichTextContent,
  ShiftException,
  Task,
  TaskColumn,
  TaskComment,
  User,
  UserSchedule,
} from '@/types';

/** Простой текстовый параграф в формате TipTap JSON. */
export function richText(...paragraphs: string[]): RichTextContent {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const daysAhead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
/** «Текущий месяц, день N» заданного года — чтобы отметки 🎂/🎉 попадали в открытый месяц демо. */
const thisMonthDate = (year: number, day: number) =>
  `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// ============================================================================
// Компания и люди
// ============================================================================

export const company: Company = {
  id: 'company-1',
  name: 'Ромашка Digital',
  ownerId: 'user-1',
  createdAt: daysAgo(180),
  amoAccountId: '31355990',
};

/** Текущий залогиненный пользователь (пока авторизации нет — всегда владелец). */
export const CURRENT_USER_ID = 'user-1';

export const users: User[] = [
  {
    id: 'user-1',
    email: 'anna.smirnova@romashka.ru',
    firstName: 'Анна',
    lastName: 'Смирнова',
    role: 'owner',
    status: 'active',
    source: 'local',
    positionIds: ['position-1'],
    phone: '+7 903 118-24-07',
    birthDate: thisMonthDate(1988, 8),
    hiredAt: '2019-11-04',
    createdAt: daysAgo(180),
  },
  {
    id: 'user-2',
    email: 'ivan.petrov@romashka.ru',
    firstName: 'Иван',
    lastName: 'Петров',
    role: 'admin',
    status: 'active',
    source: 'local',
    positionIds: ['position-2'],
    phone: '+7 926 540-11-88',
    birthDate: '1990-03-17',
    hiredAt: thisMonthDate(new Date().getFullYear() - 3, 22),
    createdAt: daysAgo(170),
  },
  {
    id: 'user-3',
    email: 'maria.kuznetsova@romashka.ru',
    firstName: 'Мария',
    lastName: 'Кузнецова',
    role: 'employee',
    status: 'active',
    source: 'amo',
    positionIds: ['position-3'],
    phone: '+7 916 774-52-08',
    birthDate: '1992-09-05',
    hiredAt: '2022-02-14',
    createdAt: daysAgo(150),
  },
  {
    id: 'user-4',
    email: 'dmitry.volkov@romashka.ru',
    firstName: 'Дмитрий',
    lastName: 'Волков',
    role: 'employee',
    status: 'active',
    source: 'amo',
    positionIds: ['position-4'],
    phone: '+7 905 612-78-30',
    birthDate: thisMonthDate(1995, 24),
    hiredAt: '2023-06-01',
    createdAt: daysAgo(120),
  },
  {
    id: 'user-5',
    email: 'elena.sokolova@romashka.ru',
    firstName: 'Елена',
    lastName: 'Соколова',
    role: 'employee',
    status: 'active',
    source: 'local',
    positionIds: ['position-5'],
    phone: '+7 909 640-72-15',
    birthDate: '1997-01-30',
    hiredAt: '2024-04-08',
    createdAt: daysAgo(90),
  },
  {
    id: 'user-6',
    email: 'sergey.morozov@romashka.ru',
    firstName: 'Сергей',
    lastName: 'Морозов',
    role: 'employee',
    status: 'active',
    source: 'amo',
    positionIds: ['position-4'],
    phone: '+7 918 233-47-60',
    birthDate: '1993-12-11',
    hiredAt: '2024-09-15',
    createdAt: daysAgo(60),
  },
  {
    id: 'user-7',
    email: 'olga.lebedeva@romashka.ru',
    firstName: 'Ольга',
    lastName: 'Лебедева',
    role: 'employee',
    status: 'invited',
    source: 'local',
    positionIds: ['position-6'],
    phone: '+7 925 447-90-61',
    birthDate: '1999-05-21',
    createdAt: daysAgo(3),
  },
  {
    id: 'user-8',
    email: 'partner@agency.ru',
    firstName: 'Павел',
    lastName: 'Никитин',
    role: 'partner',
    status: 'active',
    source: 'local',
    positionIds: [],
    phone: '+7 917 330-14-88',
    createdAt: daysAgo(30),
  },
  {
    id: 'user-9',
    email: 'viktor.kozlov@romashka.ru',
    firstName: 'Виктор',
    lastName: 'Козлов',
    role: 'employee',
    status: 'deactivated',
    source: 'amo',
    positionIds: ['position-5'],
    phone: '+7 921 305-88-42',
    birthDate: '1991-08-02',
    hiredAt: '2023-03-01',
    createdAt: daysAgo(400),
  },
];

export const departments: Department[] = [
  { id: 'department-1', name: 'Ромашка Digital', parentId: null, headUserId: 'user-1', order: 0 },
  {
    id: 'department-2',
    name: 'Продажи',
    parentId: 'department-1',
    headUserId: 'user-2',
    valuableFinalProduct:
      'Оплаченные сделки с целевыми клиентами, выполненные в срок и с плановой маржинальностью',
    order: 0,
  },
  {
    id: 'department-3',
    name: 'Маркетинг',
    parentId: 'department-1',
    headUserId: 'user-3',
    order: 1,
  },
  {
    id: 'department-4',
    name: 'Разработка',
    parentId: 'department-1',
    headUserId: 'user-4',
    order: 2,
  },
  { id: 'department-5', name: 'Отдел контента', parentId: 'department-3', order: 0 },
];

export const positions: Position[] = [
  {
    id: 'position-1',
    name: 'Генеральный директор',
    departmentId: 'department-1',
    level: 4,
    description: 'Стратегия, ключевые клиенты, финальные решения по продукту.',
    articleIds: ['article-1'],
    requiredCourseIds: [],
  },
  {
    id: 'position-2',
    name: 'Руководитель отдела продаж',
    departmentId: 'department-2',
    level: 3,
    description: 'Управление воронкой, план продаж, найм менеджеров.',
    articleIds: ['article-2'],
    requiredCourseIds: ['course-1'],
  },
  {
    id: 'position-3',
    name: 'Руководитель маркетинга',
    departmentId: 'department-3',
    level: 3,
    description: 'Лидогенерация, бренд, контент-стратегия.',
    articleIds: [],
    requiredCourseIds: [],
  },
  {
    id: 'position-4',
    name: 'Frontend-разработчик',
    departmentId: 'department-4',
    level: 0,
    description: 'Разработка клиентских интерфейсов продукта.',
    articleIds: ['article-3'],
    requiredCourseIds: ['course-2'],
  },
  {
    id: 'position-5',
    name: 'Менеджер по продажам',
    departmentId: 'department-2',
    level: 0,
    description: 'Обработка входящих лидов, ведение сделок в CRM.',
    articleIds: ['article-2'],
    requiredCourseIds: ['course-1'],
  },
  {
    id: 'position-6',
    name: 'Контент-менеджер',
    departmentId: 'department-5',
    level: 0,
    description: 'Статьи в блог, соцсети, email-рассылки.',
    articleIds: [],
    requiredCourseIds: [],
  },
];

export const invites: Invite[] = [
  {
    id: 'invite-1',
    email: 'olga.lebedeva@romashka.ru',
    token: 'demo-invite-token',
    role: 'employee',
    positionId: 'position-6',
    departmentId: 'department-5',
    invitedById: 'user-1',
    status: 'pending',
    createdAt: daysAgo(3),
  },
  {
    id: 'invite-2',
    token: 'demo-link-invite-token',
    role: 'partner',
    invitedById: 'user-1',
    status: 'pending',
    createdAt: daysAgo(1),
  },
  {
    id: 'invite-3',
    email: 'old.candidate@romashka.ru',
    token: 'demo-expired-token',
    role: 'employee',
    positionId: 'position-5',
    departmentId: 'department-2',
    invitedById: 'user-2',
    status: 'expired',
    createdAt: daysAgo(30),
  },
];

// ============================================================================
// База знаний
// ============================================================================

export const articleSections: ArticleSection[] = [
  {
    id: 'section-1',
    name: 'Общие регламенты',
    parentId: null,
    order: 0,
    access: { scope: 'company', departmentIds: [], positionIds: [], userIds: [] },
  },
  {
    id: 'section-2',
    name: 'Продажи',
    parentId: null,
    order: 1,
    access: { scope: 'custom', departmentIds: ['department-2'], positionIds: [], userIds: [] },
  },
  {
    id: 'section-3',
    name: 'Разработка',
    parentId: null,
    order: 2,
    access: { scope: 'custom', departmentIds: ['department-4'], positionIds: [], userIds: [] },
  },
];

export const articles: Article[] = [
  {
    id: 'article-1',
    sectionId: 'section-1',
    title: 'Как устроена компания: миссия и структура',
    content: richText(
      'Ромашка Digital — агентство полного цикла. Наша миссия — делать цифровые продукты, которыми пользуются с удовольствием.',
      'Компания состоит из трёх отделов: продажи, маркетинг и разработка. Каждый отдел имеет руководителя и набор должностей с описанными функциями.',
    ),
    status: 'published',
    authorId: 'user-1',
    version: 3,
    requiresAcknowledgement: true,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(14),
  },
  {
    id: 'article-2',
    sectionId: 'section-2',
    title: 'Регламент обработки входящих лидов',
    content: richText(
      'Каждый входящий лид должен получить первый ответ в течение 15 минут в рабочее время.',
      'Шаг 1. Зафиксировать лид в CRM. Шаг 2. Квалифицировать по чек-листу. Шаг 3. Назначить встречу или передать в отказ с указанием причины.',
    ),
    status: 'published',
    authorId: 'user-2',
    version: 2,
    requiresAcknowledgement: true,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(30),
  },
  {
    id: 'article-3',
    sectionId: 'section-3',
    title: 'Гайд по код-ревью',
    content: richText(
      'Любой merge request проходит ревью минимум одного разработчика. Автор не может смёржить свой MR сам.',
      'Ревьюер проверяет: корректность логики, покрытие тестами, соответствие стайлгайду.',
    ),
    status: 'published',
    authorId: 'user-4',
    version: 1,
    requiresAcknowledgement: false,
    createdAt: daysAgo(45),
    updatedAt: daysAgo(45),
  },
  {
    id: 'article-4',
    sectionId: 'section-1',
    title: 'Правила отпусков и больничных (черновик)',
    content: richText('Черновик: отпуск согласуется с руководителем минимум за две недели.'),
    status: 'draft',
    authorId: 'user-1',
    version: 1,
    requiresAcknowledgement: false,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(2),
  },
];

export const articleVersions: ArticleVersion[] = [
  {
    id: 'article-version-1',
    articleId: 'article-1',
    version: 1,
    title: 'Как устроена компания',
    content: richText('Первая версия статьи о структуре компании.'),
    authorId: 'user-1',
    createdAt: daysAgo(120),
  },
  {
    id: 'article-version-2',
    articleId: 'article-1',
    version: 2,
    title: 'Как устроена компания: миссия и структура',
    content: richText('Вторая версия: добавлена миссия компании.'),
    authorId: 'user-1',
    createdAt: daysAgo(60),
  },
];

export const acknowledgements: Acknowledgement[] = [
  { articleId: 'article-1', userId: 'user-2', acknowledgedAt: daysAgo(13) },
  { articleId: 'article-1', userId: 'user-3', acknowledgedAt: daysAgo(12) },
  { articleId: 'article-2', userId: 'user-5', acknowledgedAt: daysAgo(28) },
];

// ============================================================================
// Таск-трекер
// ============================================================================

export const labels: Label[] = [
  { id: 'label-1', name: 'Срочно', color: 'red' },
  { id: 'label-2', name: 'Клиент', color: 'amber' },
  { id: 'label-3', name: 'Внутреннее', color: 'sky' },
  { id: 'label-4', name: 'Баг', color: 'rose' },
];

export const boards: Board[] = [
  { id: 'board-1', name: 'Задачи компании', type: 'department', createdAt: daysAgo(180) },
];

export const taskColumns: TaskColumn[] = [
  { id: 'column-1', boardId: 'board-1', name: 'Бэклог', order: 0 },
  { id: 'column-2', boardId: 'board-1', name: 'В работе', order: 1, color: 'sky' },
  { id: 'column-3', boardId: 'board-1', name: 'Готово', order: 2, color: 'green' },
];

export const tasks: Task[] = [
  {
    id: 'task-1',
    boardId: 'board-1',
    columnId: 'column-1',
    order: 0,
    title: 'Согласовать план найма на квартал',
    description: richText('Собрать потребности отделов и зафиксировать бюджет найма.'),
    authorId: 'user-2',
    assigneeIds: ['user-1'],
    watcherIds: [],
    dueDate: daysAhead(0),
    priority: 'high',
    labelIds: [],
    checklist: [
      { id: 'check-1', text: 'Получить заявки от руководителей', done: true },
      { id: 'check-2', text: 'Утвердить бюджет', done: false },
    ],
    attachments: [],
    source: {
      type: 'deal',
      title: 'Сделка «Найм руководителей»',
      url: '',
      funnelName: 'HR-воронка',
      stageName: 'Согласование бюджета',
    },
    linkedArticleIds: ['article-1'],
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
  },
  {
    id: 'task-2',
    boardId: 'board-1',
    columnId: 'column-1',
    order: 1,
    title: 'Проверить просроченные счета поставщиков',
    authorId: 'user-2',
    assigneeIds: ['user-3'],
    watcherIds: [],
    dueDate: daysAgo(1),
    priority: 'urgent',
    labelIds: [],
    checklist: [],
    attachments: [],
    source: {
      type: 'company',
      title: 'Компания «СнабМаркет»',
      url: '',
    },
    linkedArticleIds: [],
    createdAt: daysAgo(7),
    updatedAt: daysAgo(2),
  },
  {
    id: 'task-3',
    boardId: 'board-1',
    columnId: 'column-1',
    order: 2,
    title: 'Обновить регламент обработки заявок',
    description: richText(
      'Синхронизировать порядок обработки заявок между продажами и поддержкой.',
    ),
    authorId: 'user-4',
    assigneeIds: ['user-4'],
    watcherIds: [],
    dueDate: daysAgo(3),
    priority: 'high',
    labelIds: [],
    checklist: [],
    attachments: [
      {
        id: 'attachment-1',
        name: 'current-flow.pdf',
        url: '#',
        size: 840_000,
        mimeType: 'application/pdf',
      },
    ],
    source: {
      type: 'task',
      title: 'CRM-задача «Обновить регламент заявок»',
      url: '',
      funnelName: 'Входящие лиды',
      stageName: 'Квалификация',
    },
    linkedArticleIds: ['article-2'],
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
  },
  {
    id: 'task-4',
    boardId: 'board-1',
    columnId: 'column-1',
    order: 3,
    title: 'Подготовить материалы для совета директоров',
    authorId: 'user-1',
    assigneeIds: ['user-5'],
    watcherIds: [],
    dueDate: daysAhead(5),
    priority: 'medium',
    labelIds: [],
    checklist: [],
    attachments: [],
    linkedArticleIds: [],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
  },
  {
    id: 'task-5',
    boardId: 'board-1',
    columnId: 'column-1',
    order: 4,
    title: 'Собрать предложения по оптимизации склада',
    authorId: 'user-1',
    assigneeIds: ['user-6'],
    watcherIds: [],
    dueDate: daysAhead(10),
    priority: 'low',
    labelIds: [],
    checklist: [],
    attachments: [],
    linkedArticleIds: [],
    createdAt: daysAgo(6),
    updatedAt: daysAgo(2),
  },
  {
    id: 'task-6',
    boardId: 'board-1',
    columnId: 'column-2',
    order: 0,
    title: 'Запустить аудит клиентского сервиса',
    authorId: 'user-2',
    assigneeIds: ['user-7'],
    watcherIds: [],
    dueDate: daysAhead(3),
    priority: 'high',
    labelIds: [],
    checklist: [
      { id: 'check-3', text: 'Собрать обращения за месяц', done: true },
      { id: 'check-4', text: 'Выделить причины повторных обращений', done: false },
    ],
    attachments: [],
    source: {
      type: 'contact',
      title: 'Контакт Ольга Лебедева',
      url: '',
    },
    linkedArticleIds: ['article-2'],
    createdAt: daysAgo(8),
    updatedAt: daysAgo(1),
  },
  {
    id: 'task-7',
    boardId: 'board-1',
    columnId: 'column-2',
    order: 1,
    title: 'Сверить цели отделов с финансовым планом',
    authorId: 'user-1',
    assigneeIds: ['user-8'],
    watcherIds: [],
    dueDate: daysAhead(7),
    priority: 'medium',
    labelIds: [],
    checklist: [],
    attachments: [],
    source: {
      type: 'deal',
      title: 'Сделка «Финплан Q3»',
      url: '',
      funnelName: 'Продажи',
      stageName: 'Переговоры',
    },
    linkedArticleIds: [],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(4),
  },
  {
    id: 'task-8',
    boardId: 'board-1',
    columnId: 'column-2',
    order: 2,
    title: 'Провести встречу по рискам проекта',
    authorId: 'user-4',
    assigneeIds: ['user-2'],
    watcherIds: [],
    dueDate: daysAhead(1),
    priority: 'medium',
    labelIds: [],
    checklist: [],
    attachments: [],
    linkedArticleIds: [],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
  },
  {
    id: 'task-9',
    boardId: 'board-1',
    columnId: 'column-3',
    order: 0,
    title: 'Закрыть отчёт по обучению сотрудников',
    authorId: 'user-1',
    assigneeIds: ['user-3'],
    watcherIds: [],
    dueDate: daysAgo(2),
    priority: 'low',
    labelIds: [],
    checklist: [],
    attachments: [],
    linkedArticleIds: [],
    completedAt: daysAgo(1),
    createdAt: daysAgo(12),
    updatedAt: daysAgo(1),
  },
  {
    id: 'task-10',
    boardId: 'board-1',
    columnId: 'column-3',
    order: 1,
    title: 'Утвердить обновлённую оргструктуру',
    authorId: 'user-1',
    assigneeIds: ['user-1'],
    watcherIds: [],
    dueDate: daysAgo(4),
    priority: 'high',
    labelIds: [],
    checklist: [],
    attachments: [],
    linkedArticleIds: ['article-1'],
    completedAt: daysAgo(2),
    createdAt: daysAgo(15),
    updatedAt: daysAgo(2),
  },
];

export const taskComments: TaskComment[] = [
  {
    id: 'comment-1',
    taskId: 'task-1',
    authorId: 'user-2',
    content: richText('Не забудь приложить кейсы из портфолио.'),
    createdAt: daysAgo(2),
  },
  {
    id: 'comment-2',
    taskId: 'task-3',
    authorId: 'user-4',
    content: richText('Макет обновили, забери свежую версию из Figma.'),
    createdAt: daysAgo(1),
  },
];

// ============================================================================
// Академия
// ============================================================================

export const courses: Course[] = [
  {
    id: 'course-1',
    title: 'Онбординг менеджера по продажам',
    description: 'Продукт, CRM и регламенты отдела продаж за одну неделю.',
    status: 'published',
    authorId: 'user-2',
    sequential: true,
    deadlineDays: 7,
    createdAt: daysAgo(80),
    updatedAt: daysAgo(20),
  },
  {
    id: 'course-2',
    title: 'Стандарты разработки',
    description: 'Код-ревью, git-flow и стайлгайд команды.',
    status: 'published',
    authorId: 'user-4',
    sequential: false,
    createdAt: daysAgo(40),
    updatedAt: daysAgo(10),
  },
  {
    id: 'course-3',
    title: 'Работа с базой знаний (черновик)',
    description: 'Как писать и поддерживать регламенты.',
    status: 'draft',
    authorId: 'user-1',
    sequential: true,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
  },
];

export const courseSections: CourseSection[] = [
  { id: 'course-section-1', courseId: 'course-1', title: 'О компании и продукте', order: 0 },
  { id: 'course-section-2', courseId: 'course-1', title: 'Работа с CRM', order: 1 },
  { id: 'course-section-3', courseId: 'course-2', title: 'Процессы команды', order: 0 },
];

export const lessons: Lesson[] = [
  {
    id: 'lesson-1',
    courseId: 'course-1',
    sectionId: 'course-section-1',
    title: 'Как устроена компания',
    order: 0,
    content: richText('Урок создан из статьи базы знаний и синхронизирован с ней.'),
    sourceArticleId: 'article-1',
    sourceMode: 'link',
  },
  {
    id: 'lesson-2',
    courseId: 'course-1',
    sectionId: 'course-section-2',
    title: 'Регламент обработки лидов',
    order: 0,
    content: richText('Копия статьи, отвязанная от источника и дополненная примерами.'),
    sourceArticleId: 'article-2',
    sourceMode: 'copy',
    quizId: 'quiz-1',
  },
  {
    id: 'lesson-3',
    courseId: 'course-2',
    sectionId: 'course-section-3',
    title: 'Код-ревью: правила игры',
    order: 0,
    content: richText('Урок о том, как мы проводим ревью и зачем.'),
    sourceArticleId: 'article-3',
    sourceMode: 'link',
  },
];

export const quizzes: Quiz[] = [
  {
    id: 'quiz-1',
    lessonId: 'lesson-2',
    passingScore: 80,
    maxAttempts: 3,
    questions: [
      {
        id: 'question-1',
        type: 'single',
        text: 'За какое время нужно дать первый ответ на входящий лид?',
        options: [
          { id: 'option-1', text: '15 минут', correct: true },
          { id: 'option-2', text: '1 час', correct: false },
          { id: 'option-3', text: 'До конца дня', correct: false },
        ],
      },
      {
        id: 'question-2',
        type: 'open',
        text: 'Опишите, что вы сделаете, если лид не отвечает три дня.',
        options: [],
      },
    ],
  },
];

export const courseAssignments: CourseAssignment[] = [
  {
    id: 'assignment-1',
    courseId: 'course-1',
    assigneeType: 'position',
    assigneeId: 'position-5',
    assignedById: 'user-2',
    createdAt: daysAgo(60),
  },
  {
    id: 'assignment-2',
    courseId: 'course-2',
    assigneeType: 'department',
    assigneeId: 'department-4',
    assignedById: 'user-4',
    createdAt: daysAgo(30),
  },
  {
    id: 'assignment-3',
    courseId: 'course-1',
    assigneeType: 'external',
    inviteToken: 'partner-course-token',
    assignedById: 'user-1',
    dueDate: daysAhead(14),
    createdAt: daysAgo(10),
  },
];

export const courseProgress: CourseProgress[] = [
  {
    userId: 'user-5',
    courseId: 'course-1',
    status: 'in_progress',
    completedLessonIds: ['lesson-1'],
    quizAttempts: [],
    startedAt: daysAgo(20),
  },
  {
    userId: 'user-6',
    courseId: 'course-2',
    status: 'completed',
    completedLessonIds: ['lesson-3'],
    quizAttempts: [],
    startedAt: daysAgo(25),
    completedAt: daysAgo(18),
  },
];

// ============================================================================
// Уведомления
// ============================================================================

export const notifications: AppNotification[] = [
  {
    id: 'notification-1',
    userId: CURRENT_USER_ID,
    type: 'task_due',
    title: 'Завтра дедлайн задачи «Провести планёрку с руководителями»',
    link: '/tasks',
    read: false,
    createdAt: daysAgo(0),
  },
  {
    id: 'notification-2',
    userId: CURRENT_USER_ID,
    type: 'task_comment',
    title: 'Иван Петров прокомментировал задачу «Подготовить КП»',
    body: 'Не забудь приложить кейсы из портфолио.',
    link: '/tasks',
    read: false,
    createdAt: daysAgo(2),
  },
  {
    id: 'notification-3',
    userId: CURRENT_USER_ID,
    type: 'article_published',
    title: 'Обновлена статья «Регламент обработки входящих лидов»',
    link: '/knowledge',
    read: true,
    createdAt: daysAgo(30),
  },
];

// ============================================================================
// График работы
// ============================================================================

const scheduleNow = new Date();
const scheduleYear = scheduleNow.getFullYear();
const scheduleMonth = scheduleNow.getMonth() + 1;
/** YYYY-MM-DD для дня текущего месяца (обрезается по длине месяца). */
const monthDate = (day: number) => {
  const last = new Date(scheduleYear, scheduleMonth, 0).getDate();
  return `${scheduleYear}-${String(scheduleMonth).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
};

/** Базовые шаблоны графика: офис — пятидневки, поддержка — сменные циклы. */
export const schedules: UserSchedule[] = [
  {
    userId: 'user-1',
    template: { type: 'week', days: [0, 1, 2, 3, 4], start: '09:00', end: '18:00' },
  },
  {
    userId: 'user-2',
    template: { type: 'week', days: [0, 1, 2, 3, 4], start: '09:00', end: '18:00' },
  },
  {
    userId: 'user-3',
    template: { type: 'week', days: [0, 1, 2, 3, 4], start: '10:00', end: '19:00' },
  },
  {
    userId: 'user-4',
    template: {
      type: 'cycle',
      on: 2,
      off: 2,
      start: '09:00',
      end: '21:00',
      cycleStart: monthDate(1),
    },
  },
  {
    userId: 'user-5',
    template: { type: 'week', days: [0, 1, 2, 3, 4], start: '09:00', end: '18:00' },
  },
  {
    userId: 'user-6',
    template: {
      type: 'cycle',
      on: 2,
      off: 2,
      start: '21:00',
      end: '09:00',
      cycleStart: monthDate(3),
    },
  },
  {
    userId: 'user-7',
    template: { type: 'week', days: [0, 1, 2, 3, 4], start: '10:00', end: '19:00' },
  },
  {
    userId: 'user-8',
    template: { type: 'week', days: [0, 1, 2, 3, 5], start: '09:00', end: '17:00' },
  },
  {
    userId: 'user-9',
    template: { type: 'week', days: [0, 1, 2, 3, 4], start: '09:00', end: '18:00' },
  },
];

/** Точечные отклонения текущего месяца: переработки, больничные, командировка, отпуск. */
export const shiftExceptions: ShiftException[] = [
  {
    id: 'shift-1',
    userId: 'user-2',
    date: monthDate(8),
    type: 'work',
    start: '09:00',
    end: '20:00',
    note: 'Работа на выезде — встреча с клиентом в 14:00',
  },
  { id: 'shift-2', userId: 'user-3', date: monthDate(10), type: 'sick' },
  { id: 'shift-3', userId: 'user-3', date: monthDate(11), type: 'sick' },
  {
    id: 'shift-4',
    userId: 'user-7',
    date: monthDate(14),
    type: 'trip',
    note: 'Командировка в Казань — внедрение у клиента',
  },
  { id: 'shift-5', userId: 'user-7', date: monthDate(15), type: 'trip' },
  { id: 'shift-6', userId: 'user-7', date: monthDate(16), type: 'trip' },
  { id: 'shift-7', userId: 'user-5', date: monthDate(20), type: 'vacation' },
  { id: 'shift-8', userId: 'user-5', date: monthDate(21), type: 'vacation' },
  { id: 'shift-9', userId: 'user-5', date: monthDate(22), type: 'vacation' },
  { id: 'shift-10', userId: 'user-5', date: monthDate(23), type: 'vacation' },
  { id: 'shift-11', userId: 'user-5', date: monthDate(24), type: 'vacation' },
  {
    id: 'shift-12',
    userId: 'user-4',
    date: monthDate(6),
    type: 'work',
    start: '09:00',
    end: '15:00',
    note: 'Отпросился — семейные обстоятельства',
  },
  {
    id: 'shift-13',
    userId: 'user-3',
    date: monthDate(17),
    type: 'work',
    start: '09:00',
    end: '18:00',
    note: 'Сместила смену на час раньше — забирает ребёнка',
  },
];

// ============================================================================
// Распределение сделок
// ============================================================================

export const distributionGroups: DealDistributionGroup[] = [
  {
    id: 'distribution-group-1',
    name: 'Входящие заявки — Отдел продаж',
    description: 'Новые заявки распределяются между сотрудниками на смене',
    active: true,
    algorithm: 'round_robin',
    memberIds: ['user-2', 'user-5', 'user-3', 'user-4', 'user-6'],
    disabledMemberIds: [],
    source: 'Сайт · форма «Заявка»',
    dealLimit: 10,
    unclaimedMinutes: 15,
    createdAt: daysAgo(45),
  },
];

export const distributionEvents: DistributionEvent[] = [
  {
    id: 'distribution-event-1',
    groupId: 'distribution-group-1',
    dealNumber: 4821,
    userId: 'user-2',
    status: 'accepted',
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: 'distribution-event-2',
    groupId: 'distribution-group-1',
    dealNumber: 4820,
    userId: 'user-5',
    status: 'in_progress',
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 'distribution-event-3',
    groupId: 'distribution-group-1',
    dealNumber: 4819,
    userId: 'user-3',
    status: 'reassigned',
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
  {
    id: 'distribution-event-4',
    groupId: 'distribution-group-1',
    dealNumber: 4818,
    userId: 'user-4',
    status: 'declined',
    createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
];
