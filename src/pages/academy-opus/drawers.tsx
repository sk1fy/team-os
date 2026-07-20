/**
 * Боковые панели Академии Opus: настройки курса, назначение и сертификат.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Download, Trash2 } from 'lucide-react';
import { academyOpusApi } from '@/api/academyOpus';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/client';
import type { Course, Department, ID, Position, User } from '@/types';
import { Button, Checkbox, Drawer, Input, Select, Textarea } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { toast } from '@/stores/toast';
import { fullName } from './labels';

// ---------------------------------------------------------------------------
// Настройки курса
// ---------------------------------------------------------------------------

export function CourseSettingsDrawer({
  course,
  open,
  onClose,
}: {
  course: Course | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    published: false,
    visibility: 'restricted' as Course['visibility'],
    sequential: true,
    deadlineDays: '',
  });

  useEffect(() => {
    if (!course) return;
    setForm({
      title: course.title,
      description: course.description ?? '',
      published: course.status === 'published',
      visibility: course.visibility,
      sequential: course.sequential,
      deadlineDays: course.deadlineDays ? String(course.deadlineDays) : '',
    });
  }, [course]);

  const save = useMutation({
    mutationFn: academyOpusApi.updateCourse,
    onSuccess: () => {
      toast.success('Курс сохранён');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyOpus.all });
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось сохранить курс'),
  });

  if (!course) return null;

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} title="Настройки курса" size="md">
      <div className="space-y-4">
        <Input
          label="Название"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <Textarea
          rows={3}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="Описание курса"
        />
        <Select
          label="Видимость"
          value={form.visibility}
          onValueChange={(value) => setForm({ ...form, visibility: value as Course['visibility'] })}
          options={[
            { value: 'restricted', label: 'По назначению' },
            { value: 'company', label: 'Вся компания' },
            { value: 'public', label: 'Публичный' },
          ]}
        />
        <Input
          label="Дедлайн, дней с момента назначения"
          type="number"
          min={0}
          value={form.deadlineDays}
          onChange={(event) => setForm({ ...form, deadlineDays: event.target.value })}
          hint="Пусто — без дедлайна. Отсюда считается просрочка в отчёте."
        />
        <Checkbox
          checked={form.sequential}
          onCheckedChange={(checked) => setForm({ ...form, sequential: checked })}
          label="Последовательное прохождение"
        />
        <Checkbox
          checked={form.published}
          onCheckedChange={(checked) => setForm({ ...form, published: checked })}
          label="Опубликован"
        />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              id: course.id,
              title: form.title.trim() || course.title,
              description: form.description,
              status: form.published ? 'published' : 'draft',
              visibility: form.visibility,
              sequential: form.sequential,
              deadlineDays: Number(form.deadlineDays) || 0,
            })
          }
        >
          Сохранить
        </Button>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Назначение курса
// ---------------------------------------------------------------------------

export function AssignDrawer({
  course,
  users,
  positions,
  departments,
  open,
  onClose,
}: {
  course: Course | undefined;
  users: User[];
  positions: Position[];
  departments: Department[];
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [assigneeType, setAssigneeType] = useState<'user' | 'position' | 'department'>('user');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const assignmentsQuery = useQuery({
    queryKey: queryKeys.academyOpus.assignments,
    queryFn: academyOpusApi.getAssignments,
    enabled: open,
  });

  const assign = useMutation({
    mutationFn: academyOpusApi.assignCourse,
    onSuccess: () => {
      toast.success('Курс назначен');
      setAssigneeId('');
      setDueDate('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyOpus.all });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось назначить курс'),
  });

  const unassign = useMutation({
    mutationFn: academyOpusApi.unassign,
    onSuccess: () => {
      toast.success('Назначение снято');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyOpus.all });
    },
    onError: () => toast.error('Не удалось снять назначение'),
  });

  if (!course) return null;

  const options: Record<typeof assigneeType, Array<{ value: string; label: string }>> = {
    user: users
      .filter((user) => user.status !== 'deactivated')
      .map((user) => ({ value: user.id, label: fullName(user) })),
    position: positions.map((position) => ({ value: position.id, label: position.name })),
    department: departments.map((department) => ({
      value: department.id,
      label: department.name,
    })),
  };

  const courseAssignments = (assignmentsQuery.data ?? []).filter(
    (assignment) => assignment.courseId === course.id,
  );

  function labelFor(type: string, id: ID | undefined) {
    if (!id) return 'Внешняя ссылка';
    if (type === 'user') return fullName(users.find((user) => user.id === id));
    if (type === 'position') return positions.find((item) => item.id === id)?.name ?? '—';
    return departments.find((item) => item.id === id)?.name ?? '—';
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={`Назначить: ${course.title}`}
      size="md"
    >
      <div className="space-y-4">
        <Select
          label="Кому"
          value={assigneeType}
          onValueChange={(value) => {
            setAssigneeType(value as typeof assigneeType);
            setAssigneeId('');
          }}
          options={[
            { value: 'user', label: 'Сотруднику' },
            { value: 'position', label: 'Должности' },
            { value: 'department', label: 'Отделу' },
          ]}
        />
        <Select
          label="Адресат"
          placeholder="Выберите"
          value={assigneeId}
          onValueChange={setAssigneeId}
          options={options[assigneeType]}
        />
        <Input
          label="Дедлайн"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          hint={
            course.deadlineDays
              ? `Пусто — сработает дедлайн курса: ${course.deadlineDays} дн.`
              : 'Пусто — без дедлайна.'
          }
        />
        <Button
          className="w-full"
          disabled={!assigneeId}
          loading={assign.isPending}
          onClick={() =>
            assign.mutate({
              courseId: course.id,
              assigneeType,
              assigneeId,
              dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
            })
          }
        >
          Назначить
        </Button>
      </div>

      <div className="mt-6">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Уже назначено</h4>
        {courseAssignments.length === 0 ? (
          <p className="text-sm text-slate-500">Пока никому.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {courseAssignments.map((assignment) => (
              <li key={assignment.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm text-slate-900">
                    {labelFor(assignment.assigneeType, assignment.assigneeId)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {assignment.assigneeType === 'user'
                      ? 'Лично'
                      : assignment.assigneeType === 'position'
                        ? 'Должность'
                        : assignment.assigneeType === 'department'
                          ? 'Отдел'
                          : 'Внешний'}
                    {assignment.dueDate ? ` · до ${formatDate(assignment.dueDate)}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => unassign.mutate(assignment.id)}
                  aria-label="Снять назначение"
                >
                  <Trash2 className="size-4 text-danger-600" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Сертификат
// ---------------------------------------------------------------------------

/**
 * Сертификат печатается по реальной записи о выдаче: номер и дата берутся
 * из неё, а не из «сегодня», как в базовой Академии.
 */
export function CertificateDrawer({
  courseId,
  courses,
  user,
  open,
  onClose,
}: {
  courseId: ID | null;
  courses: Course[];
  user: User | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const certificatesQuery = useQuery({
    queryKey: queryKeys.academyOpus.certificates,
    queryFn: academyOpusApi.getCertificates,
    enabled: open,
  });

  const course = courses.find((item) => item.id === courseId);
  const certificate = (certificatesQuery.data ?? []).find(
    (item) => item.courseId === courseId && item.userId === user?.id,
  );

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Сертификат"
      size="lg"
      footer={
        certificate ? (
          <Button variant="secondary" onClick={() => window.print()}>
            <Download className="size-4" />
            Печать / PDF
          </Button>
        ) : undefined
      }
    >
      {certificate ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center rounded-lg border-4 border-double border-primary-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc)] p-10 text-center">
          <Award className="mb-6 size-16 text-warning-500" />
          <p className="text-sm font-semibold tracking-[0.24em] text-slate-400 uppercase">
            TeamOS Academy
          </p>
          <h2 className="mt-6 text-3xl font-bold text-slate-950">Сертификат</h2>
          <p className="mt-5 text-sm text-slate-500">подтверждает, что</p>
          <p className="mt-2 text-2xl font-semibold text-primary-800">{fullName(user)}</p>
          <p className="mt-5 text-sm text-slate-500">прошёл курс</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{course?.title}</p>
          <p className="mt-8 text-sm text-slate-500">{formatDate(certificate.issuedAt)}</p>
          <p className="mt-1 text-xs tracking-wider text-slate-400">№ {certificate.number}</p>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">
          Сертификат выдаётся автоматически после прохождения всех уроков курса.
        </p>
      )}
    </Drawer>
  );
}
