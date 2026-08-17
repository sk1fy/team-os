import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, LoaderCircle, Users } from 'lucide-react';
import type { ID, User } from '@/types';
import { fullName } from '@/lib/labels';
import { cn } from '@/lib/cn';

interface ScheduleEmployeePickerProps {
  users: User[];
  pendingUserId?: ID;
  onToggle: (user: User, enabled: boolean) => void;
}

export function ScheduleEmployeePicker({
  users,
  pendingUserId,
  onToggle,
}: ScheduleEmployeePickerProps) {
  const sortedUsers = [...users].sort((left, right) =>
    fullName(left).localeCompare(fullName(right), 'ru'),
  );
  const enabledCount = users.filter((user) => user.showInSchedule === true).length;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Настроить сотрудников в графике"
          title="Сотрудники в графике"
          className="relative flex size-9.5 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-surface text-slate-500 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
        >
          <Users className="size-4.5" />
          {enabledCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-primary-600 px-1 text-[10px] leading-none font-bold text-white">
              {enabledCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="animate-popover-in z-50 w-80 overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-popover"
        >
          <div className="border-b border-slate-100 px-3.5 py-3">
            <div className="text-sm font-semibold text-ink">Сотрудники в графике</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Включите тех, кого нужно показывать в графике работ.
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {sortedUsers.length === 0 ? (
              <div className="px-3 py-5 text-center text-sm text-slate-500">
                Нет доступных сотрудников
              </div>
            ) : (
              sortedUsers.map((user) => {
                const pending = pendingUserId === user.id;
                return (
                  <DropdownMenu.CheckboxItem
                    key={user.id}
                    checked={user.showInSchedule === true}
                    disabled={pending}
                    onCheckedChange={(checked) => onToggle(user, checked)}
                    onSelect={(event) => event.preventDefault()}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 outline-none select-none',
                      'data-[highlighted]:bg-slate-100 data-[disabled]:cursor-wait data-[disabled]:opacity-60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4.5 shrink-0 items-center justify-center rounded border',
                        user.showInSchedule === true
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-slate-300 bg-white text-transparent',
                      )}
                    >
                      {pending ? (
                        <LoaderCircle className="size-3 animate-spin text-current" />
                      ) : (
                        <DropdownMenu.ItemIndicator forceMount>
                          <Check className="size-3" />
                        </DropdownMenu.ItemIndicator>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-700">
                        {fullName(user)}
                      </span>
                      <span className="block truncate text-xs text-slate-400">{user.email}</span>
                    </span>
                  </DropdownMenu.CheckboxItem>
                );
              })
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
