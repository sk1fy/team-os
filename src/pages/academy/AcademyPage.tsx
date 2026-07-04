import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useTitle } from '@reactuses/core';
import {
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  GripVertical,
  GraduationCap,
  LinkIcon,
  Lock,
  Plus,
  Send,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { academyApi, kbApi, orgApi } from '@/api';
import type {
  Article,
  AssigneeType,
  Course,
  CourseProgress,
  CourseSection,
  ID,
  Lesson,
  LessonSourceMode,
  Quiz,
  QuizQuestion,
  User,
} from '@/types';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { fullName } from '@/lib/labels';
import { plainTextToRichText } from '@/lib/richText';
import { toast } from '@/stores/toast';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Input,
  Modal,
  RichTextEditor,
  RichTextView,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/cn';

const emptyCourses: Course[] = [];
const emptySections: CourseSection[] = [];
const emptyLessons: Lesson[] = [];
const emptyProgress: CourseProgress[] = [];
const emptyUsers: User[] = [];
const emptyArticles: Article[] = [];
const emptyQuizzes: Quiz[] = [];

const statusLabels = {
  draft: 'Черновик',
  published: 'Опубликован',
} satisfies Record<Course['status'], string>;

function progressPercent(courseId: ID, lessons: Lesson[], progress?: CourseProgress) {
  const courseLessons = lessons.filter((lesson) => lesson.courseId === courseId);
  if (courseLessons.length === 0) return 0;
  return Math.round(((progress?.completedLessonIds.length ?? 0) / courseLessons.length) * 100);
}

function CourseCard({
  course,
  lessons,
  progress,
  active,
  onSelect,
}: {
  course: Course;
  lessons: Lesson[];
  progress?: CourseProgress;
  active: boolean;
  onSelect: () => void;
}) {
  const percent = progressPercent(course.id, lessons, progress);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'overflow-hidden rounded-lg border bg-surface text-left shadow-card transition-colors',
        active ? 'border-primary-300 ring-2 ring-primary-100' : 'border-slate-200 hover:border-primary-200',
      )}
    >
      <div className="h-24 bg-[linear-gradient(135deg,#EFF6F5,#DDEEEC_48%,#BBE2DF)] px-4 py-3">
        <Badge variant={course.status === 'published' ? 'success' : 'warning'}>
          {statusLabels[course.status]}
        </Badge>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-semibold text-slate-950">{course.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{course.description}</p>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{lessons.filter((lesson) => lesson.courseId === course.id).length} уроков</span>
          <span>{course.sequential ? 'Последовательно' : 'Свободно'}</span>
        </div>
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-success-500" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-500">{percent}% прохождения</div>
        </div>
      </div>
    </button>
  );
}

function LessonDraggable({
  lesson,
  active,
  locked,
  onSelect,
}: {
  lesson: Lesson;
  active: boolean;
  locked?: boolean;
  onSelect: () => void;
}) {
  const draggable = useDraggable({
    id: lesson.id,
    data: { type: 'lesson', lessonId: lesson.id, sectionId: lesson.sectionId, order: lesson.order },
  });
  const droppable = useDroppable({
    id: `lesson-over-${lesson.id}`,
    data: { type: 'lesson-over', sectionId: lesson.sectionId, order: lesson.order },
  });
  const setNodeRef = (node: HTMLElement | null) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-2 transition-colors',
        active ? 'border-primary-200 bg-primary-50' : 'border-slate-200 bg-surface',
        droppable.isOver && 'border-primary-300',
        draggable.isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        {...draggable.attributes}
        {...draggable.listeners}
        className="cursor-grab rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
        aria-label="Перетащить урок"
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-slate-800">{lesson.title}</span>
        {lesson.sourceArticleId && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
            {lesson.sourceMode === 'link' ? <LinkIcon className="size-3" /> : <FileText className="size-3" />}
            {lesson.sourceMode === 'link' ? 'Синхронизирован' : 'Копия статьи'}
          </span>
        )}
      </button>
      {locked && <Lock className="size-4 text-slate-300" />}
    </div>
  );
}

function CourseSettings({
  course,
}: {
  course?: Course;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Course['status']>('draft');
  const [sequential, setSequential] = useState(true);
  const [deadlineDays, setDeadlineDays] = useState('');

  useEffect(() => {
    if (!course) return;
    setTitle(course.title);
    setDescription(course.description ?? '');
    setStatus(course.status);
    setSequential(course.sequential);
    setDeadlineDays(course.deadlineDays ? String(course.deadlineDays) : '');
  }, [course]);

  const updateCourse = useMutation({
    mutationFn: academyApi.updateCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'courses'] });
      toast.success('Настройки курса сохранены');
    },
  });

  if (!course) return null;

  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-surface p-4 shadow-card lg:grid-cols-2">
      <Input label="Название" value={title} onChange={(event) => setTitle(event.target.value)} />
      <Select
        label="Статус"
        value={status}
        onValueChange={(value) => setStatus(value as Course['status'])}
        options={[
          { value: 'draft', label: 'Черновик' },
          { value: 'published', label: 'Опубликован' },
        ]}
      />
      <Textarea
        label="Описание"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
      />
      <div className="space-y-3">
        <Input
          label="Дедлайн, дней"
          type="number"
          min={1}
          value={deadlineDays}
          onChange={(event) => setDeadlineDays(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={sequential}
            onChange={(event) => setSequential(event.target.checked)}
          />
          Последовательное прохождение
        </label>
        <Button
          size="sm"
          loading={updateCourse.isPending}
          onClick={() =>
            title.trim() &&
            updateCourse.mutate({
              id: course.id,
              title: title.trim(),
              description,
              status,
              sequential,
              deadlineDays: Number(deadlineDays) || undefined,
            })
          }
        >
          Сохранить
        </Button>
      </div>
    </div>
  );
}

function ImportArticleModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (articleId: ID, mode: LessonSourceMode) => void;
}) {
  const articlesQuery = useQuery({ queryKey: ['kb', 'articles'], queryFn: () => kbApi.getArticles() });
  const articles = articlesQuery.data ?? emptyArticles;
  const [articleId, setArticleId] = useState('');
  const [mode, setMode] = useState<LessonSourceMode>('link');

  useEffect(() => {
    if (open && articles[0]) setArticleId(articles[0].id);
  }, [articles, open]);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Импорт из базы знаний"
      description="Выберите режим связи урока со статьёй."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => articleId && onImport(articleId, mode)}>Импортировать</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Статья"
          value={articleId}
          onValueChange={setArticleId}
          options={articles.map((article) => ({ value: article.id, label: article.title }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-md border border-slate-200 p-3">
            <input
              type="radio"
              checked={mode === 'link'}
              onChange={() => setMode('link')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-slate-900">Ссылка</span>
            <p className="mt-1 text-xs text-slate-500">Контент синхронизирован с БЗ и не редактируется в уроке.</p>
          </label>
          <label className="rounded-md border border-slate-200 p-3">
            <input
              type="radio"
              checked={mode === 'copy'}
              onChange={() => setMode('copy')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-slate-900">Копия</span>
            <p className="mt-1 text-xs text-slate-500">Урок отвязан от источника, контент можно менять.</p>
          </label>
        </div>
      </div>
    </Modal>
  );
}

function QuizBuilder({ lesson, quiz }: { lesson?: Lesson; quiz?: Quiz }) {
  const queryClient = useQueryClient();
  const [passingScore, setPassingScore] = useState(80);
  const [maxAttempts, setMaxAttempts] = useState('3');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    setPassingScore(quiz?.passingScore ?? 80);
    setMaxAttempts(quiz?.maxAttempts ? String(quiz.maxAttempts) : '3');
    setQuestions(quiz?.questions ?? []);
  }, [quiz, lesson?.id]);

  const saveQuiz = useMutation({
    mutationFn: academyApi.upsertQuiz,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['academy', 'lessons'] });
      toast.success('Тест сохранён');
    },
  });

  if (!lesson) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Тест урока</h3>
          <p className="text-sm text-slate-500">Одиночный, множественный выбор и открытые ответы.</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setQuestions((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                type: 'single',
                text: 'Новый вопрос',
                options: [
                  { id: crypto.randomUUID(), text: 'Вариант 1', correct: true },
                  { id: crypto.randomUUID(), text: 'Вариант 2', correct: false },
                ],
              },
            ])
          }
        >
          <Plus className="size-4" />
          Вопрос
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Input
          label="Проходной балл, %"
          type="number"
          min={0}
          max={100}
          value={passingScore}
          onChange={(event) => setPassingScore(Number(event.target.value))}
        />
        <Input
          label="Попыток"
          type="number"
          min={1}
          value={maxAttempts}
          onChange={(event) => setMaxAttempts(event.target.value)}
        />
      </div>

      <div className="space-y-3">
        {questions.map((question) => (
          <div key={question.id} className="rounded-md border border-slate-200 p-3">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <Select
                value={question.type}
                onValueChange={(value) =>
                  setQuestions((current) =>
                    current.map((item) =>
                      item.id === question.id ? { ...item, type: value as QuizQuestion['type'] } : item,
                    ),
                  )
                }
                options={[
                  { value: 'single', label: 'Один ответ' },
                  { value: 'multiple', label: 'Несколько' },
                  { value: 'open', label: 'Открытый' },
                ]}
              />
              <Input
                value={question.text}
                onChange={(event) =>
                  setQuestions((current) =>
                    current.map((item) =>
                      item.id === question.id ? { ...item, text: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
            {question.type !== 'open' && (
              <div className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={option.correct}
                      onChange={() =>
                        setQuestions((current) =>
                          current.map((item) =>
                            item.id === question.id
                              ? {
                                  ...item,
                                  options: item.options.map((currentOption) =>
                                    currentOption.id === option.id
                                      ? { ...currentOption, correct: !currentOption.correct }
                                      : currentOption,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <input
                      value={option.text}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((item) =>
                            item.id === question.id
                              ? {
                                  ...item,
                                  options: item.options.map((currentOption) =>
                                    currentOption.id === option.id
                                      ? { ...currentOption, text: event.target.value }
                                      : currentOption,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                      className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-sm focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
                    />
                  </label>
                ))}
              </div>
            )}
            {question.type === 'open' && (
              <p className="mt-3 rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-700">
                Открытый ответ попадёт на ручную проверку автора курса.
              </p>
            )}
          </div>
        ))}
        {questions.length === 0 && (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">В тесте пока нет вопросов.</p>
        )}
      </div>

      <Button
        className="mt-4"
        loading={saveQuiz.isPending}
        onClick={() =>
          saveQuiz.mutate({
            id: quiz?.id,
            lessonId: lesson.id,
            questions,
            passingScore,
            maxAttempts: Number(maxAttempts) || undefined,
          })
        }
      >
        Сохранить тест
      </Button>
    </div>
  );
}

function AssignmentModal({
  course,
  open,
  onClose,
}: {
  course?: Course;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: orgApi.getDepartments });
  const [assigneeType, setAssigneeType] = useState<AssigneeType>('user');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const assignCourse = useMutation({
    mutationFn: academyApi.assignCourse,
    onSuccess: (assignment) => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'assignments'] });
      toast.success(
        assignment.inviteToken
          ? `Внешняя ссылка: /learn/${assignment.courseId}?token=${assignment.inviteToken}`
          : 'Курс назначен',
      );
      onClose();
    },
  });

  const options = useMemo(() => {
    if (assigneeType === 'user') {
      return (usersQuery.data ?? []).map((user) => ({ value: user.id, label: fullName(user) }));
    }
    if (assigneeType === 'position') {
      return (positionsQuery.data ?? []).map((position) => ({ value: position.id, label: position.name }));
    }
    if (assigneeType === 'department') {
      return (departmentsQuery.data ?? []).map((department) => ({ value: department.id, label: department.name }));
    }
    return [{ value: 'external', label: 'Внешняя ссылка' }];
  }, [assigneeType, departmentsQuery.data, positionsQuery.data, usersQuery.data]);

  useEffect(() => {
    setAssigneeId(options[0]?.value ?? '');
  }, [options]);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Назначить курс"
      description={course?.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            loading={assignCourse.isPending}
            onClick={() =>
              course &&
              assignCourse.mutate({
                courseId: course.id,
                assigneeType,
                assigneeId: assigneeType === 'external' ? undefined : assigneeId,
                dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined,
              })
            }
          >
            Назначить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Кому"
          value={assigneeType}
          onValueChange={(value) => setAssigneeType(value as AssigneeType)}
          options={[
            { value: 'user', label: 'Человек' },
            { value: 'position', label: 'Должность' },
            { value: 'department', label: 'Отдел' },
            { value: 'external', label: 'Внешний партнёр' },
          ]}
        />
        <Select label="Получатель" value={assigneeId} onValueChange={setAssigneeId} options={options} />
        <Input
          label="Дедлайн"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </div>
    </Modal>
  );
}

function CertificateDrawer({
  course,
  user,
  open,
  onClose,
}: {
  course?: Course;
  user?: User;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Сертификат"
      size="lg"
      footer={
        <Button variant="secondary" onClick={() => window.print()}>
          <Download className="size-4" />
          Печать / PDF
        </Button>
      }
    >
      <div className="flex min-h-[520px] flex-col items-center justify-center rounded-lg border-4 border-double border-primary-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc)] p-10 text-center">
        <Award className="mb-6 size-16 text-warning-500" />
        <p className="text-sm font-semibold tracking-[0.24em] text-slate-400 uppercase">TeamOS Academy</p>
        <h2 className="mt-6 text-3xl font-bold text-slate-950">Сертификат</h2>
        <p className="mt-5 text-sm text-slate-500">подтверждает, что</p>
        <p className="mt-2 text-2xl font-semibold text-primary-800">{user ? fullName(user) : 'Сотрудник'}</p>
        <p className="mt-5 text-sm text-slate-500">прошёл курс</p>
        <p className="mt-2 text-xl font-semibold text-slate-950">{course?.title}</p>
        <p className="mt-8 text-sm text-slate-500">{formatDate(new Date().toISOString())}</p>
      </div>
    </Drawer>
  );
}

export function AcademyPage() {
  useTitle('Академия — TeamOS');
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [selectedCourseId, setSelectedCourseId] = useState<ID>('course-1');
  const [selectedLessonId, setSelectedLessonId] = useState<ID | null>(null);
  const [activeDragLesson, setActiveDragLesson] = useState<Lesson | null>(null);
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);

  const coursesQuery = useQuery({ queryKey: ['academy', 'courses'], queryFn: academyApi.getCourses });
  const sectionsQuery = useQuery({
    queryKey: ['academy', 'sections', selectedCourseId],
    queryFn: () => academyApi.getCourseSections(selectedCourseId),
    enabled: Boolean(selectedCourseId),
  });
  const lessonsQuery = useQuery({
    queryKey: ['academy', 'lessons', selectedCourseId],
    queryFn: () => academyApi.getLessons(selectedCourseId),
    enabled: Boolean(selectedCourseId),
  });
  const allLessonsQuery = useQuery({ queryKey: ['academy', 'lessons', 'all'], queryFn: () => academyApi.getLessons() });
  const progressQuery = useQuery({ queryKey: ['academy', 'progress'], queryFn: () => academyApi.getProgress() });
  const assignmentsQuery = useQuery({ queryKey: ['academy', 'assignments'], queryFn: academyApi.getAssignments });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const quizzesQuery = useQuery({ queryKey: ['academy', 'quizzes'], queryFn: () => academyApi.getQuizzes() });

  const courses = coursesQuery.data ?? emptyCourses;
  const sections = sectionsQuery.data ?? emptySections;
  const lessons = lessonsQuery.data ?? emptyLessons;
  const progress = progressQuery.data ?? emptyProgress;
  const users = usersQuery.data ?? emptyUsers;
  const quizzes = quizzesQuery.data ?? emptyQuizzes;
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  const currentUser = users.find((user) => user.id === 'user-1') ?? users[0];
  const selectedProgress = progress.find(
    (item) => item.courseId === selectedCourseId && item.userId === (currentUser?.id ?? 'user-1'),
  );
  const selectedQuiz = quizzes.find((quiz) => quiz.id === selectedLesson?.quizId);
  const allLessons = allLessonsQuery.data ?? lessons;

  useEffect(() => {
    if (!selectedCourseId && courses[0]) setSelectedCourseId(courses[0].id);
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (lessons[0] && !lessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  const createCourse = useMutation({
    mutationFn: academyApi.createCourse,
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'courses'] });
      setSelectedCourseId(course.id);
      setNewCourseOpen(false);
      toast.success('Курс создан');
    },
  });

  const createSection = useMutation({
    mutationFn: academyApi.createCourseSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'sections'] });
      toast.success('Раздел добавлен');
    },
  });

  const createLesson = useMutation({
    mutationFn: academyApi.createLesson,
    onSuccess: (lesson) => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'lessons'] });
      setSelectedLessonId(lesson.id);
      toast.success('Урок добавлен');
    },
  });

  const updateLesson = useMutation({
    mutationFn: academyApi.updateLesson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'lessons'] });
      toast.success('Урок сохранён');
    },
  });

  const moveLesson = useMutation({
    mutationFn: academyApi.moveLesson,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academy', 'lessons'] }),
  });

  const markComplete = useMutation({
    mutationFn: academyApi.markLessonComplete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'progress'] });
      toast.success('Прогресс обновлён');
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const lessonId = event.active.data.current?.lessonId as ID | undefined;
    setActiveDragLesson(lessons.find((lesson) => lesson.id === lessonId) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const lessonId = event.active.data.current?.lessonId as ID | undefined;
    const over = event.over?.data.current as { sectionId?: ID; order?: number } | undefined;
    setActiveDragLesson(null);
    if (!lessonId || !over?.sectionId) return;
    moveLesson.mutate({ id: lessonId, sectionId: over.sectionId, order: over.order ?? 0 });
  };

  const addLessonToSection = (sectionId: ID) => {
    const title = window.prompt('Название урока');
    if (!title?.trim() || !selectedCourse) return;
    createLesson.mutate({
      courseId: selectedCourse.id,
      sectionId,
      title: title.trim(),
      content: plainTextToRichText('Новый урок. Добавьте материалы, примеры и контрольные вопросы.'),
    });
  };

  const exportCsv = () => {
    const rows = [
      ['Сотрудник', 'Курс', 'Статус', 'Прогресс'],
      ...progress.map((item) => {
        const user = users.find((candidate) => candidate.id === item.userId);
        const course = courses.find((candidate) => candidate.id === item.courseId);
        return [
          user ? fullName(user) : item.userId,
          course?.title ?? item.courseId,
          item.status,
          `${progressPercent(item.courseId, allLessons, item)}%`,
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    void navigator.clipboard.writeText(csv);
    toast.success('CSV скопирован в буфер обмена');
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Академия"
        description="Курсы, конструктор уроков, тесты, назначения и прохождение."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAssignmentOpen(true)} disabled={!selectedCourse}>
              <Send className="size-4" />
              Назначить
            </Button>
            <Button onClick={() => setNewCourseOpen(true)}>
              <Plus className="size-4" />
              Курс
            </Button>
          </>
        }
      />

      <Tabs
        className="mt-6"
        items={[
          {
            value: 'catalog',
            label: 'Каталог',
            content: (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {courses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      lessons={allLessons}
                      progress={progress.find((item) => item.courseId === course.id)}
                      active={course.id === selectedCourseId}
                      onSelect={() => setSelectedCourseId(course.id)}
                    />
                  ))}
                </div>
                <aside className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                    <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
                      <GraduationCap className="size-5 text-primary-500" />
                      Мои назначенные
                    </div>
                    <div className="space-y-3">
                      {assignmentsQuery.data
                        ?.filter((assignment) => assignment.assigneeType !== 'external')
                        .map((assignment) => {
                          const course = courses.find((item) => item.id === assignment.courseId);
                          const itemProgress = progress.find((item) => item.courseId === assignment.courseId);
                          return course ? (
                            <button
                              key={assignment.id}
                              type="button"
                              onClick={() => setSelectedCourseId(course.id)}
                              className="w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                            >
                              <span className="block text-sm font-medium text-slate-900">{course.title}</span>
                              <span className="text-xs text-slate-500">
                                {progressPercent(course.id, allLessons, itemProgress)}% · назначен{' '}
                                {formatRelativeDate(assignment.createdAt)}
                              </span>
                            </button>
                          ) : null;
                        })}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                    <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
                      <Sparkles className="size-5 text-warning-500" />
                      Черновик с AI
                    </div>
                    <p className="text-sm text-slate-500">
                      Место под генерацию структуры курса оставлено в конструкторе. Сейчас кнопка готова как UI-заглушка.
                    </p>
                    <Button className="mt-3" variant="secondary" size="sm" disabled>
                      Сгенерировать черновик
                    </Button>
                  </div>
                </aside>
              </div>
            ),
          },
          {
            value: 'builder',
            label: 'Конструктор',
            content: (
              <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <CourseSettings course={selectedCourse} />
                  <DndContext
                    sensors={sensors}
                    collisionDetection={pointerWithin}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveDragLesson(null)}
                  >
                    <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-950">Структура курса</h3>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const title = window.prompt('Название раздела');
                            if (title?.trim() && selectedCourse) {
                              createSection.mutate({ courseId: selectedCourse.id, title: title.trim() });
                            }
                          }}
                        >
                          <Plus className="size-4" />
                          Раздел
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {sections.map((section) => {
                          const sectionLessons = lessons.filter((lesson) => lesson.sectionId === section.id);
                          return (
                            <section key={section.id} className="rounded-md border border-slate-200 p-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="font-medium text-slate-900">{section.title}</div>
                                <Button size="sm" variant="ghost" onClick={() => addLessonToSection(section.id)}>
                                  <Plus className="size-4" />
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {sectionLessons.map((lesson) => (
                                  <LessonDraggable
                                    key={lesson.id}
                                    lesson={lesson}
                                    active={lesson.id === selectedLesson?.id}
                                    onSelect={() => setSelectedLessonId(lesson.id)}
                                  />
                                ))}
                                {sectionLessons.length === 0 && (
                                  <div className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-400">
                                    Нет уроков
                                  </div>
                                )}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </div>
                    <DragOverlay>
                      {activeDragLesson && (
                        <div className="rounded-md border border-primary-200 bg-surface px-3 py-2 shadow-popover">
                          {activeDragLesson.title}
                        </div>
                      )}
                    </DragOverlay>
                  </DndContext>
                </div>

                <div className="space-y-4">
                  {selectedLesson ? (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <Input
                              label="Название урока"
                              value={selectedLesson.title}
                              onChange={(event) =>
                                updateLesson.mutate({ id: selectedLesson.id, title: event.target.value })
                              }
                            />
                            {selectedLesson.sourceArticleId && (
                              <div className="mt-2">
                                <Badge variant={selectedLesson.sourceMode === 'link' ? 'success' : 'warning'}>
                                  {selectedLesson.sourceMode === 'link'
                                    ? 'Синхронизировано с базой знаний'
                                    : 'Копия отвязана от источника'}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <Button variant="secondary" onClick={() => setImportOpen(true)}>
                            <BookOpen className="size-4" />
                            Импорт из БЗ
                          </Button>
                        </div>
                        {selectedLesson.sourceMode === 'link' ? (
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                            <RichTextView content={selectedLesson.content} />
                          </div>
                        ) : (
                          <RichTextEditor
                            value={selectedLesson.content}
                            onChange={(content) =>
                              updateLesson.mutate({ id: selectedLesson.id, content })
                            }
                            minHeight={360}
                          />
                        )}
                      </div>
                      <QuizBuilder lesson={selectedLesson} quiz={selectedQuiz} />
                    </>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-surface p-8 text-center text-sm text-slate-500 shadow-card">
                      Выберите урок в структуре курса.
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            value: 'player',
            label: 'Прохождение',
            content: (
              <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
                  <div className="mb-3 text-sm font-semibold text-slate-950">{selectedCourse?.title}</div>
                  <div className="space-y-2">
                    {lessons.map((lesson, index) => {
                      const completed = selectedProgress?.completedLessonIds.includes(lesson.id);
                      const previousComplete =
                        index === 0 || selectedProgress?.completedLessonIds.includes(lessons[index - 1]?.id);
                      const locked = Boolean(selectedCourse?.sequential && !previousComplete);
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          disabled={locked}
                          onClick={() => setSelectedLessonId(lesson.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                            lesson.id === selectedLesson?.id ? 'bg-primary-50 text-primary-800' : 'hover:bg-slate-50',
                            locked && 'cursor-not-allowed text-slate-300 hover:bg-transparent',
                          )}
                        >
                          {completed ? <Check className="size-4 text-success-600" /> : <ChevronRight className="size-4" />}
                          <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                          {locked && <Lock className="size-4" />}
                        </button>
                      );
                    })}
                  </div>
                </aside>
                <main className="rounded-lg border border-slate-200 bg-surface p-6 shadow-card">
                  {selectedLesson && (
                    <>
                      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2>{selectedLesson.title}</h2>
                          {selectedQuiz && (
                            <p className="mt-1 text-sm text-slate-500">
                              Тест: {selectedQuiz.questions.length} вопросов, проходной балл {selectedQuiz.passingScore}%
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          loading={markComplete.isPending}
                          onClick={() =>
                            selectedCourse &&
                            markComplete.mutate({ courseId: selectedCourse.id, lessonId: selectedLesson.id })
                          }
                        >
                          <Check className="size-4" />
                          Завершить урок
                        </Button>
                      </div>
                      <RichTextView content={selectedLesson.content} />
                      {selectedQuiz && (
                        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <h3 className="mb-3 text-base font-semibold text-slate-950">Контрольный тест</h3>
                          <div className="space-y-3">
                            {selectedQuiz.questions.map((question) => (
                              <div key={question.id} className="rounded-md bg-white p-3">
                                <p className="text-sm font-medium text-slate-900">{question.text}</p>
                                {question.type === 'open' ? (
                                  <Textarea className="mt-2" rows={3} placeholder="Ответ для ручной проверки" />
                                ) : (
                                  <div className="mt-2 space-y-2">
                                    {question.options.map((option) => (
                                      <label key={option.id} className="flex items-center gap-2 text-sm">
                                        <input type={question.type === 'single' ? 'radio' : 'checkbox'} name={question.id} />
                                        {option.text}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </main>
              </div>
            ),
          },
          {
            value: 'progress',
            label: 'Прогресс',
            content: (
              <div className="rounded-lg border border-slate-200 bg-surface shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold text-slate-950">
                    <UsersRound className="size-5 text-slate-400" />
                    Дашборд прогресса
                  </div>
                  <Button variant="secondary" size="sm" onClick={exportCsv}>
                    <Download className="size-4" />
                    CSV
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-400 uppercase">
                        <th className="px-4 py-3 font-semibold">Сотрудник</th>
                        <th className="px-4 py-3 font-semibold">Курс</th>
                        <th className="px-4 py-3 font-semibold">Статус</th>
                        <th className="px-4 py-3 font-semibold">Прогресс</th>
                        <th className="px-4 py-3 font-semibold">Проверка</th>
                        <th className="px-4 py-3 font-semibold">Сертификат</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.map((item) => {
                        const user = users.find((candidate) => candidate.id === item.userId);
                        const course = courses.find((candidate) => candidate.id === item.courseId);
                        const percent = progressPercent(item.courseId, allLessons, item);
                        const pendingReview = item.quizAttempts.some((attempt) => attempt.pendingReview);
                        return (
                          <tr key={`${item.userId}-${item.courseId}`} className="border-b border-slate-100 last:border-0">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {user && <Avatar name={fullName(user)} src={user.avatarUrl} size="sm" />}
                                <span className="text-sm font-medium text-slate-900">
                                  {user ? fullName(user) : item.userId}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{course?.title}</td>
                            <td className="px-4 py-3">
                              <Badge variant={item.status === 'completed' ? 'success' : 'primary'}>
                                {item.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full bg-success-500" style={{ width: `${percent}%` }} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={pendingReview ? 'warning' : 'neutral'}>
                                {pendingReview ? 'Нужна' : 'Нет'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={item.status !== 'completed'}
                                onClick={() => {
                                  if (course) setSelectedCourseId(course.id);
                                  setCertificateOpen(true);
                                }}
                              >
                                <Award className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={newCourseOpen}
        onOpenChange={(next) => !next && setNewCourseOpen(false)}
        title="Новый курс"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewCourseOpen(false)}>
              Отмена
            </Button>
            <Button
              loading={createCourse.isPending}
              onClick={() =>
                createCourse.mutate({
                  title: 'Новый курс',
                  description: 'Черновик курса для команды.',
                  status: 'draft',
                  sequential: true,
                })
              }
            >
              Создать
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">Будет создан черновик с первым разделом. Название можно изменить в конструкторе.</p>
      </Modal>

      <ImportArticleModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(articleId, mode) => {
          if (!selectedLesson) return;
          updateLesson.mutate({ id: selectedLesson.id, sourceArticleId: articleId, sourceMode: mode });
          setImportOpen(false);
        }}
      />
      <AssignmentModal course={selectedCourse} open={assignmentOpen} onClose={() => setAssignmentOpen(false)} />
      <CertificateDrawer
        course={selectedCourse}
        user={currentUser}
        open={certificateOpen}
        onClose={() => setCertificateOpen(false)}
      />
      {selectedCourse && (
        <div className="mt-4 text-right">
          <Link
            to={`/learn/${selectedCourse.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            Открыть внешний режим
            <ExternalLink className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
