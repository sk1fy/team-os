import {
  Activity,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Clock,
  Copy,
  CopyPlus,
  FileText,
  GraduationCap,
  Home,
  LayoutGrid,
  Library,
  ListChecks,
  ListTodo,
  MapPin,
  MessageCircle,
  Palette,
  PenLine,
  PhoneCall,
  Rows3,
  ScanSearch,
  Search,
  Send,
  Settings,
  Shuffle,
  TextCursorInput,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

/**
 * Модель навигации TeamOS (концепт C «Раздел и контекст»).
 *
 * Рейл слева — разделы и группы интеграций. Панель раздела рядом — вкладки
 * раздела (вместо вкладок сверху) и контекст страницы. Вкладки живут в URL:
 * базовый путь раздела + `?tab=<key>`; вкладка по умолчанию — без параметра.
 */

export interface NavTab {
  /** Значение параметра `tab`; у вкладки по умолчанию — первая в списке. */
  key: string;
  label: string;
  /** Полный адрес вкладки (путь + query). */
  to: string;
  /** Доп. префиксы пути, на которых вкладка считается открытой (страница группы и т. п.). */
  prefixes?: string[];
  disabled?: boolean;
  /** Подсказка для неактивной вкладки. */
  hint?: string;
  /** Только для владельца и администратора. */
  manageOnly?: boolean;
}

export interface NavSection {
  id: 'home' | 'employees' | 'schedule' | 'knowledge' | 'academy' | 'catalog' | 'settings';
  /** Полное название — заголовок панели раздела. */
  title: string;
  /** Короткая подпись в рейле. */
  railLabel: string;
  icon: LucideIcon;
  path: string;
  /** Префиксы пути, которые относятся к разделу. */
  prefixes: string[];
  tabs?: NavTab[];
  badge?: string;
  disabled?: boolean;
  hint?: string;
  /** Подпись над заголовком панели раздела. */
  eyebrow: string;
}

export type WidgetGroupId =
  'tasks' | 'analytics' | 'automation' | 'deals' | 'communication' | 'fields';

export interface WidgetGroup {
  id: WidgetGroupId;
  title: string;
  railLabel: string;
  icon: LucideIcon;
}

export type WidgetId =
  | 'task-queue'
  | 'task-control'
  | 'activity-control'
  | 'distribution'
  | 'first-call'
  | 'analytics-v3'
  | 'duplicates'
  | 'processes'
  | 'google-docs'
  | 'status-date'
  | 'deal-copy'
  | 'color-deals'
  | 'whatsapp'
  | 'telegram'
  | 'telegram-alerts'
  | 'client-time'
  | 'field-copy'
  | 'handy-fields'
  | 'list-search'
  | 'field-groups'
  | 'map-address'
  | 'dadata';

export interface WidgetDef {
  id: WidgetId;
  title: string;
  group: WidgetGroupId;
  icon: LucideIcon;
  /** Одна фраза о том, что делает виджет. */
  summary: string;
  /** Что умеет — для описания неподключённого виджета. */
  features?: string[];
  /** Подключённый в TeamOS виджет: свой раздел и вкладки. */
  path?: string;
  prefixes?: string[];
  tabs?: NavTab[];
  /**
   * Ярлык на часть другого виджета (не отдельный виджет): в списке группы
   * ведёт по адресу `path`, в каталоге не показывается.
   */
  shortcutOf?: WidgetId;
}

const tab = (path: string, key: string, label: string, extra: Partial<NavTab> = {}): NavTab => ({
  key,
  label,
  to: extra.to ?? (key ? `${path}?tab=${key}` : path),
  ...extra,
});

export const mainSections: NavSection[] = [
  {
    id: 'home',
    title: 'Главная',
    railLabel: 'Главная',
    icon: Home,
    path: '/dashboard',
    prefixes: ['/dashboard', '/notifications'],
    eyebrow: 'TeamOS',
    tabs: [
      { key: 'today', label: 'Сегодня', to: '/dashboard' },
      {
        key: 'notifications',
        label: 'Уведомления',
        to: '/notifications',
        prefixes: ['/notifications'],
      },
    ],
  },
  {
    id: 'employees',
    title: 'Сотрудники',
    railLabel: 'Сотрудники',
    icon: Users,
    path: '/employees',
    prefixes: ['/employees', '/structure'],
    eyebrow: 'TeamOS',
    tabs: [
      tab('/employees', 'list', 'Сотрудники', { to: '/employees', prefixes: ['/employees/'] }),
      tab('/employees', 'structure', 'Оргструктура', {
        disabled: true,
        hint: 'Находится в разработке',
      }),
    ],
  },
  {
    id: 'schedule',
    title: 'График работы',
    railLabel: 'График',
    icon: CalendarDays,
    path: '/schedule',
    prefixes: ['/schedule'],
    eyebrow: 'TeamOS',
    tabs: [
      tab('/schedule', 'schedule', 'График', { to: '/schedule' }),
      tab('/schedule', 'stats', 'Статистика', { disabled: true, hint: 'Находится в разработке' }),
    ],
  },
  {
    id: 'knowledge',
    title: 'База знаний',
    railLabel: 'Знания',
    icon: Library,
    path: '/knowledge',
    prefixes: ['/knowledge'],
    badge: 'Бета',
    eyebrow: 'TeamOS',
  },
  {
    id: 'academy',
    title: 'Академия',
    railLabel: 'Академия',
    icon: GraduationCap,
    path: '/academy',
    prefixes: ['/academy', '/learn'],
    disabled: true,
    hint: 'Находится в разработке',
    eyebrow: 'TeamOS',
  },
];

export const settingsSection: NavSection = {
  id: 'settings',
  title: 'Настройки',
  railLabel: 'Настройки',
  icon: Settings,
  path: '/settings',
  prefixes: ['/settings'],
  eyebrow: 'TeamOS',
  tabs: [
    tab('/settings', 'company', 'Компания', { to: '/settings' }),
    tab('/settings', 'profile', 'Мой профиль'),
    tab('/settings', 'plan', 'Тариф и доступ', { manageOnly: true }),
    tab('/settings', 'appearance', 'Оформление'),
  ],
};

export const catalogSection: NavSection = {
  id: 'catalog',
  title: 'Каталог виджетов',
  railLabel: 'Каталог',
  icon: LayoutGrid,
  path: '/integrations',
  prefixes: ['/integrations'],
  eyebrow: 'Интеграции',
};

export const widgetGroups: WidgetGroup[] = [
  { id: 'tasks', title: 'Задачи', railLabel: 'Задачи', icon: ListChecks },
  { id: 'analytics', title: 'Аналитика', railLabel: 'Аналитика', icon: Activity },
  { id: 'automation', title: 'Автоматизация', railLabel: 'Автоматика', icon: ScanSearch },
  { id: 'deals', title: 'Сделки', railLabel: 'Сделки', icon: Shuffle },
  { id: 'communication', title: 'Коммуникации', railLabel: 'Связь', icon: MessageCircle },
  { id: 'fields', title: 'Поля и карточки', railLabel: 'Поля', icon: PenLine },
];

export const widgets: WidgetDef[] = [
  // ---- Задачи ----
  {
    id: 'task-queue',
    title: 'Очередь задач',
    group: 'tasks',
    icon: ListTodo,
    summary: 'Панель задач менеджера в amoCRM: что делать прямо сейчас.',
    path: '/activity-control?tab=task-panel',
    shortcutOf: 'activity-control',
  },
  {
    id: 'task-control',
    title: 'Контроль задач',
    group: 'tasks',
    icon: ListChecks,
    summary: 'Не даёт оставить сделку без задачи — по правилам, которые настраиваются в TeamOS.',
    path: '/task-control',
    prefixes: ['/task-control'],
    tabs: [
      tab('/task-control', 'rules', 'Правила', { to: '/task-control' }),
      tab('/task-control', 'connection', 'Подключение'),
    ],
  },
  // ---- Аналитика ----
  {
    id: 'activity-control',
    title: 'Контроль активности',
    group: 'analytics',
    icon: Activity,
    summary: 'Звонки и задачи менеджеров в реальном времени — на дашбордах и в панели задач.',
    path: '/activity-control',
    prefixes: ['/activity-control', '/legacy/ssd-activity'],
    tabs: [
      tab('/activity-control', 'dashboards', 'Дашборды', { to: '/activity-control' }),
      tab('/activity-control', 'task-panel', 'Панель задач'),
      tab('/activity-control', 'connection', 'Подключение'),
    ],
  },
  {
    id: 'first-call',
    title: 'Первый звонок',
    group: 'analytics',
    icon: PhoneCall,
    summary: 'Считает, как быстро менеджеры звонят по новым заявкам.',
    features: [
      'Время до первого звонка по каждой сделке',
      'Сравнение менеджеров',
      'Сделки, по которым так и не позвонили',
    ],
  },
  {
    id: 'analytics-v3',
    title: 'Аналитика v3',
    group: 'analytics',
    icon: ChartColumn,
    summary: 'Отчёты по продажам, воронкам и менеджерам на данных amoCRM.',
    features: [
      'Готовые отчёты по воронкам и менеджерам',
      'Свои показатели и фильтры',
      'Выгрузка и регулярные сводки',
    ],
  },
  // ---- Автоматизация ----
  {
    id: 'duplicates',
    title: 'Автопоиск дубликатов',
    group: 'automation',
    icon: ScanSearch,
    summary: 'Ищет дубли контактов, компаний и сделок в amoCRM и помогает их объединить.',
    features: [
      'Поиск по телефону, почте и названию',
      'Объединение дублей с сохранением истории',
      'Проверка новых записей сразу при создании',
    ],
  },
  {
    id: 'processes',
    title: 'Процессы',
    group: 'automation',
    icon: Workflow,
    summary: 'Автоматизирует рутинные действия в amoCRM по правилам «если — то».',
    features: [
      'Действия по событиям в сделке',
      'Смена полей, ответственного, этапа',
      'Без программистов',
    ],
  },
  {
    id: 'google-docs',
    title: 'Google Документы',
    group: 'automation',
    icon: FileText,
    summary: 'Формирует договоры и счета в Google Документах по данным сделки.',
    features: [
      'Шаблоны с полями amoCRM',
      'Документ сохраняется в сделке',
      'Пакетное создание документов',
    ],
  },
  // ---- Сделки ----
  {
    id: 'distribution',
    title: 'Распределение сделок',
    group: 'deals',
    icon: Shuffle,
    summary: 'Раздаёт новые сделки менеджерам на смене по правилам группы.',
    path: '/distribution',
    prefixes: ['/distribution'],
    tabs: [
      tab('/distribution', 'queue', 'Очередь', { to: '/distribution' }),
      tab('/distribution', 'groups', 'Группы', { prefixes: ['/distribution/'] }),
      tab('/distribution', 'journal', 'Журнал'),
      tab('/distribution', 'connection', 'Подключение'),
    ],
  },
  {
    id: 'status-date',
    title: 'Дата перехода в статус',
    group: 'deals',
    icon: CalendarClock,
    summary: 'Записывает в поле сделки дату перехода на каждый этап.',
    features: [
      'Дата для любого этапа воронки',
      'Можно строить отчёты и фильтры',
      'Работает для уже идущих сделок',
    ],
  },
  {
    id: 'deal-copy',
    title: 'Копирование сделок',
    group: 'deals',
    icon: CopyPlus,
    summary: 'Создаёт копию сделки с нужными полями, контактами и задачами.',
    features: [
      'Копирование в другую воронку',
      'Выбор переносимых полей',
      'Повторные продажи в один клик',
    ],
  },
  {
    id: 'color-deals',
    title: 'Цветные сделки',
    group: 'deals',
    icon: Palette,
    summary: 'Подсвечивает сделки в списке и канбане цветом по условиям.',
    features: [
      'Цвет по полю, тегу или сроку',
      'Просроченные сделки видно сразу',
      'Свои правила для каждой воронки',
    ],
  },
  // ---- Коммуникации ----
  {
    id: 'whatsapp',
    title: 'Написать в WhatsApp',
    group: 'communication',
    icon: MessageCircle,
    summary: 'Открывает чат WhatsApp с клиентом прямо из карточки сделки или контакта.',
    features: [
      'Кнопка WhatsApp у номера телефона',
      'Работает в сделках, контактах и компаниях',
      'Без интеграций и настройки',
    ],
  },
  {
    id: 'telegram',
    title: 'Написать в Telegram',
    group: 'communication',
    icon: Send,
    summary: 'Открывает чат Telegram с клиентом в один клик из карточки amoCRM.',
    features: [
      'Кнопка Telegram у номера телефона',
      'Работает в сделках, контактах и компаниях',
      'Без интеграций и настройки',
    ],
  },
  {
    id: 'telegram-alerts',
    title: 'Оповещения в Telegram',
    group: 'communication',
    icon: BellRing,
    summary: 'Присылает в Telegram уведомления о событиях в amoCRM.',
    features: [
      'Новые сделки, задачи и смена этапов',
      'Отправка в личку или в рабочий чат',
      'Гибкие условия для каждого события',
    ],
  },
  // ---- Поля и карточки ----
  {
    id: 'client-time',
    title: 'Время клиента',
    group: 'fields',
    icon: Clock,
    summary: 'Показывает местное время клиента по номеру телефона или адресу.',
    features: [
      'Часовой пояс по коду номера',
      'Подсветка, если у клиента ночь',
      'Видно в карточке и в списке',
    ],
  },
  {
    id: 'field-copy',
    title: 'Копирование полей',
    group: 'fields',
    icon: Copy,
    summary: 'Переносит значения полей между сделками, контактами и компаниями.',
    features: [
      'Копирование по событию или вручную',
      'Сопоставление полей разных сущностей',
      'Не нужно заполнять одно и то же дважды',
    ],
  },
  {
    id: 'handy-fields',
    title: 'Удобные поля',
    group: 'fields',
    icon: TextCursorInput,
    summary: 'Делает поля карточки удобнее: маски ввода, подсказки, обязательность.',
    features: [
      'Маски для телефона, ИНН и дат',
      'Обязательные поля по этапам',
      'Подсказки при заполнении',
    ],
  },
  {
    id: 'list-search',
    title: 'Поиск в поле со списком',
    group: 'fields',
    icon: Search,
    summary: 'Добавляет поиск в длинные поля со списком значений.',
    features: [
      'Поиск по мере ввода',
      'Работает в мультисписках',
      'Подходит для справочников на сотни значений',
    ],
  },
  {
    id: 'field-groups',
    title: 'Группировка полей',
    group: 'fields',
    icon: Rows3,
    summary: 'Собирает поля карточки в сворачиваемые группы.',
    features: [
      'Свои группы для каждой воронки',
      'Скрытие пустых и лишних полей',
      'Карточка короче и понятнее',
    ],
  },
  {
    id: 'map-address',
    title: 'Адрес на карте',
    group: 'fields',
    icon: MapPin,
    summary: 'Показывает адрес клиента на карте прямо в карточке amoCRM.',
    features: [
      'Карта по адресу из поля',
      'Маршрут до клиента',
      'Работает в сделках, контактах и компаниях',
    ],
  },
  {
    id: 'dadata',
    title: 'DaData',
    group: 'fields',
    icon: BadgeCheck,
    summary: 'Подсказывает и проверяет адреса, компании и ФИО по базе DaData.',
    features: [
      'Заполнение реквизитов по ИНН',
      'Подсказки адресов при вводе',
      'Проверка корректности данных',
    ],
  },
];

/** Подключённый в TeamOS виджет (есть свой раздел). */
export const isConnectedWidget = (widget: WidgetDef) => Boolean(widget.path) && !widget.shortcutOf;

export const widgetById = (id: string) => widgets.find((widget) => widget.id === id);

export const widgetsOfGroup = (group: WidgetGroupId) =>
  widgets.filter((widget) => widget.group === group);

/** Страница описания виджета, который ещё нельзя настроить в TeamOS. */
export const widgetInfoPath = (id: WidgetId) => `/integrations/${id}`;

export const widgetHref = (widget: WidgetDef) => widget.path ?? widgetInfoPath(widget.id);

/** Куда ведёт клик по группе в рейле: первый подключённый виджет, иначе первый в группе. */
export function groupHomeHref(group: WidgetGroupId): string {
  const list = widgetsOfGroup(group).filter((widget) => !widget.shortcutOf);
  const connected = list.find(isConnectedWidget);
  return widgetHref(connected ?? list[0]);
}

const matchesPrefix = (pathname: string, prefix: string) =>
  prefix.endsWith('/')
    ? pathname.startsWith(prefix)
    : pathname === prefix || pathname.startsWith(`${prefix}/`);

export type NavLocation =
  | { kind: 'section'; section: NavSection }
  | { kind: 'widget'; widget: WidgetDef; group: WidgetGroup }
  | { kind: 'none' };

/** Что открыто: раздел, виджет (подключённый или страница описания) или ничего. */
export function resolveNavLocation(pathname: string): NavLocation {
  const infoMatch = pathname.match(/^\/integrations\/([^/]+)\/?$/);
  if (infoMatch) {
    const widget = widgetById(infoMatch[1]);
    if (widget) {
      return { kind: 'widget', widget, group: widgetGroups.find((g) => g.id === widget.group)! };
    }
  }
  for (const widget of widgets) {
    if (widget.shortcutOf || !widget.prefixes) continue;
    if (widget.prefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
      return { kind: 'widget', widget, group: widgetGroups.find((g) => g.id === widget.group)! };
    }
  }
  for (const section of [...mainSections, settingsSection, catalogSection]) {
    if (section.prefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
      return { kind: 'section', section };
    }
  }
  return { kind: 'none' };
}

/**
 * Активная вкладка: сначала точное совпадение пути и `?tab=`, затем префиксы.
 * Неизвестный `tab` на базовом пути — вкладка по умолчанию (её показывает и страница).
 */
export function resolveActiveTab(
  tabs: NavTab[] | undefined,
  pathname: string,
  search: string,
): NavTab | undefined {
  if (!tabs?.length) return undefined;
  const current = new URLSearchParams(search).get('tab') ?? '';
  const parsed = tabs.map((item) => {
    const url = new URL(item.to, 'http://teamos.local');
    return { item, path: url.pathname, tab: url.searchParams.get('tab') ?? '' };
  });
  const exact = parsed.find(
    (entry) => entry.path === pathname && entry.tab === current && !entry.item.disabled,
  );
  if (exact) return exact.item;
  const byPrefix = parsed.find((entry) =>
    entry.item.prefixes?.some(
      (prefix) => matchesPrefix(pathname, prefix) && pathname !== entry.path,
    ),
  );
  if (byPrefix) return byPrefix.item;
  const base = parsed.find((entry) => entry.path === pathname && entry.tab === '');
  return base?.item;
}

/** Ключ вкладки страницы из `?tab=`; неизвестное значение — вкладка по умолчанию. */
export function readTabKey<K extends string>(search: string, keys: readonly K[], fallback: K): K {
  const value = new URLSearchParams(search).get('tab');
  return value && (keys as readonly string[]).includes(value) ? (value as K) : fallback;
}

/** Адрес вкладки: вкладка по умолчанию — без параметра. */
export function tabHref(path: string, key: string, defaultKey: string): string {
  return key === defaultKey ? path : `${path}?tab=${encodeURIComponent(key)}`;
}
