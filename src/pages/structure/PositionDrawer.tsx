import { queryKeys } from '@/api/queryKeys';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Library, Pencil, Trash2 } from 'lucide-react';
import type { ID, Position } from '@/types';
import { academyApi, kbApi, orgApi } from '@/api';
import { fullName } from '@/lib/labels';
import { Avatar, Badge, Button, Drawer } from '@/components/ui';

interface PositionDrawerProps {
  positionId: ID | null;
  onClose: () => void;
  onEdit: (position: Position) => void;
  onDelete: (position: Position) => void;
  onOpenUser: (id: ID) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function PositionDrawer({
  positionId,
  onClose,
  onEdit,
  onDelete,
  onOpenUser,
}: PositionDrawerProps) {
  const navigate = useNavigate();

  const { data: positions } = useQuery({
    queryKey: queryKeys.positions,
    queryFn: orgApi.getPositions,
  });
  const { data: departments } = useQuery({
    queryKey: queryKeys.departments,
    queryFn: orgApi.getDepartments,
  });
  const { data: users } = useQuery({ queryKey: queryKeys.users.all, queryFn: orgApi.getUsers });
  const { data: articles } = useQuery({
    queryKey: queryKeys.kb.articles,
    queryFn: () => kbApi.getArticles(),
  });
  const { data: courses } = useQuery({
    queryKey: queryKeys.academy.courses,
    queryFn: academyApi.getCourses,
  });

  const position = positions?.find((p) => p.id === positionId);
  const department = departments?.find((d) => d.id === position?.departmentId);
  const occupants = users?.filter((u) => position && u.positionIds.includes(position.id)) ?? [];
  const linkedArticles = articles?.filter((a) => position?.articleIds.includes(a.id)) ?? [];
  const requiredCourses = courses?.filter((c) => position?.requiredCourseIds.includes(c.id)) ?? [];

  return (
    <Drawer
      open={positionId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={position?.name ?? 'Должность'}
      description={department ? `Отдел «${department.name}»` : undefined}
      footer={
        position && (
          <>
            <Button
              variant="ghost"
              className="mr-auto text-danger-600 hover:bg-danger-50"
              onClick={() => onDelete(position)}
            >
              <Trash2 className="size-4" />
              Удалить
            </Button>
            <Button variant="secondary" onClick={() => onEdit(position)}>
              <Pencil className="size-4" />
              Редактировать
            </Button>
          </>
        )
      }
    >
      {!position ? (
        <div className="space-y-3">
          <div className="h-5 animate-pulse rounded bg-slate-200" />
          <div className="h-20 animate-pulse rounded bg-slate-200" />
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Уровень">
            <Badge
              variant={
                position.level === 4 ? 'primary' : position.level === 0 ? 'warning' : 'neutral'
              }
            >
              Уровень {position.level ?? 0}
            </Badge>
          </Section>

          <Section title="Описание функций">
            {position.description ? (
              <p className="text-sm whitespace-pre-line text-slate-700">{position.description}</p>
            ) : (
              <p className="text-sm text-slate-400">Описание пока не заполнено.</p>
            )}
          </Section>

          <Section title="Сотрудники на должности">
            {occupants.length === 0 ? (
              <Badge variant="warning">Вакантно</Badge>
            ) : (
              <div className="space-y-1">
                {occupants.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => onOpenUser(user.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
                  >
                    <Avatar name={fullName(user)} src={user.avatarUrl} size="sm" />
                    <span className="text-sm text-slate-700">{fullName(user)}</span>
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title="Регламенты">
            {linkedArticles.length === 0 ? (
              <p className="text-sm text-slate-400">Регламенты не привязаны.</p>
            ) : (
              <div className="space-y-1">
                {linkedArticles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => navigate('/knowledge')}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
                  >
                    <Library className="size-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm text-slate-700">{article.title}</span>
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title="Обязательные курсы">
            {requiredCourses.length === 0 ? (
              <p className="text-sm text-slate-400">Курсы не назначены.</p>
            ) : (
              <div className="space-y-1">
                {requiredCourses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => navigate('/academy')}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
                  >
                    <GraduationCap className="size-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm text-slate-700">{course.title}</span>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </Drawer>
  );
}
