import { Briefcase, CalendarDays, Mail, Phone } from 'lucide-react';
import type { Department, Position, User } from '@/types';
import { formatDate } from '@/lib/format';
import { fullName, roleLabels, roleVariants, userStatusLabels, userStatusVariants } from '@/lib/labels';
import { Avatar, Badge } from '@/components/ui';

interface EmployeeProfileHeaderProps {
  user: User;
  positions: Position[];
  departments: Department[];
  headingLevel?: 'h1' | 'h2';
  actions?: React.ReactNode;
}

export function EmployeeProfileHeader({
  user,
  positions,
  departments,
  headingLevel = 'h1',
  actions,
}: EmployeeProfileHeaderProps) {
  const userPositions = positions.filter((position) => user.positionIds.includes(position.id));
  const Heading = headingLevel;

  return (
    <div className="rounded-lg border border-slate-200 bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start gap-5">
        <Avatar name={fullName(user)} src={user.avatarUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading
              className={
                headingLevel === 'h1'
                  ? undefined
                  : 'text-xl font-bold text-ink'
              }
            >
              {fullName(user)}
            </Heading>
            <Badge variant={roleVariants[user.role]}>{roleLabels[user.role]}</Badge>
            <Badge variant={userStatusVariants[user.status]}>{userStatusLabels[user.status]}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <Mail className="size-4 text-slate-400" />
              {user.email}
            </span>
            {user.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-4 text-slate-400" />
                {user.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-slate-400" />В компании с{' '}
              {formatDate(user.createdAt)}
            </span>
          </div>
          {userPositions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {userPositions.map((position) => {
                const department = departments.find((item) => item.id === position.departmentId);
                return (
                  <span
                    key={position.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-surface-muted px-2.5 py-1 text-sm text-slate-700"
                  >
                    <Briefcase className="size-3.5 text-slate-400" />
                    {position.name}
                    {department && <span className="text-slate-400">· {department.name}</span>}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {actions}
      </div>
    </div>
  );
}