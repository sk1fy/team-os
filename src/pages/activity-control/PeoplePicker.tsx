import { useState } from 'react';
import { Search } from 'lucide-react';
import { Avatar, Switch } from '@/components/ui';
import { groupEmployees, toggleEmployee, toggleGroup, type Employee } from './model';

const SEARCH_FROM = 10;

/**
 * Выбор сотрудников amoCRM по отделам (`peoplePick()` концепта): у отдела —
 * счётчик и переключатель «выбрать всех», у сотрудника — флажок.
 */
export function PeoplePicker({
  users,
  selected,
  onChange,
  disabled,
}: {
  users: Employee[];
  selected: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  if (users.length === 0)
    return (
      <p className="rounded-[10px] border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        Сотрудников нет в доступном справочнике.
      </p>
    );
  const q = query.trim().toLowerCase();
  const groups = groupEmployees(users)
    .map((group) => ({
      ...group,
      all: group.users,
      users: q ? group.users.filter((user) => user.name.toLowerCase().includes(q)) : group.users,
    }))
    .filter((group) => group.users.length > 0);
  const known = new Set(users.map((user) => user.id));
  const unknown = selected.filter((id) => !known.has(id)).length;
  return (
    <div className="space-y-2">
      {users.length >= SEARCH_FROM && (
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Найти сотрудника"
            placeholder="Найти сотрудника"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
          />
        </label>
      )}
      <div className="rounded-[10px] border border-slate-200 p-1.5">
        {groups.length === 0 && (
          <p className="px-2.5 py-4 text-center text-sm text-slate-500">Никого не нашли</p>
        )}
        {groups.map((group) => {
          const ids = group.all.map((user) => user.id);
          const count = ids.filter((id) => selected.includes(id)).length;
          return (
            <div key={group.id} className="mt-1 first:mt-0">
              <div className="flex items-center gap-2.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[13px]">
                <b className="min-w-0 flex-1 truncate font-semibold text-ink">{group.name}</b>
                <span className="text-xs text-slate-500 tabular-nums">
                  {count} / {ids.length}
                </span>
                <Switch
                  aria-label={`${group.name}: выбрать всех`}
                  checked={count === ids.length}
                  disabled={disabled}
                  onCheckedChange={() => onChange(toggleGroup(selected, ids))}
                />
              </div>
              {group.users.map((user) => (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink hover:bg-slate-50 has-disabled:cursor-default has-disabled:opacity-60"
                >
                  <input
                    type="checkbox"
                    className="size-[17px] shrink-0 accent-primary-600"
                    checked={selected.includes(user.id)}
                    disabled={disabled}
                    onChange={(e) => onChange(toggleEmployee(selected, user.id, e.target.checked))}
                  />
                  <span aria-hidden="true" className="contents">
                    <Avatar name={user.name} size="xs" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{user.name}</span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
      {unknown > 0 && (
        <p className="text-xs text-slate-500">
          Ещё выбрано: {unknown} — их нет в текущем справочнике amoCRM.
        </p>
      )}
    </div>
  );
}
