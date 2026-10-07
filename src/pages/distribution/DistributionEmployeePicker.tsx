import { useEffect, useId, useRef, useState } from 'react';
import { Search, ChevronDown, UserPlus } from 'lucide-react';
import type { User } from '@/types';
import { fullName } from '@/lib/labels';

export function DistributionEmployeePicker({
  users,
  onAdd,
  disabled,
}: {
  users: User[];
  onAdd: (id: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const filtered = users
    .filter((user) =>
      fullName(user).toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')),
    )
    .sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'));
  const highlighted = filtered[Math.min(index, Math.max(0, filtered.length - 1))];
  useEffect(() => {
    if (open && highlighted)
      document.getElementById(`${id}-${highlighted.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, highlighted, id]);
  const add = (userId: string) => {
    onAdd(userId);
    setQuery('');
    setIndex(0);
    setOpen(false);
    input.current?.focus();
  };
  return (
    <div
      className="relative mt-4"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <label htmlFor={id} className="text-xs font-semibold text-slate-700">
        Добавить сотрудника
      </label>
      <div className="relative mt-1.5">
        <Search aria-hidden="true" className="absolute top-3 left-3 size-4 text-slate-400" />
        <input
          id={id}
          ref={input}
          role="combobox"
          type="text"
          autoComplete="off"
          disabled={disabled}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={open && highlighted ? `${id}-${highlighted.id}` : undefined}
          placeholder="Найти сотрудника по имени"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setIndex((current) =>
                open
                  ? Math.max(
                      0,
                      Math.min(filtered.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)),
                    )
                  : 0,
              );
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              if (open && highlighted) add(highlighted.id);
              else setOpen(true);
            }
          }}
          className="h-10 w-full rounded-md border border-slate-200 bg-surface pr-9 pl-9 text-sm focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
        />
        <ChevronDown aria-hidden="true" className="absolute top-3 right-3 size-4 text-slate-400" />
      </div>
      {open && (
        <ul
          id={`${id}-options`}
          role="listbox"
          aria-label="Доступные сотрудники"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-surface p-1 shadow-popover"
        >
          {filtered.length === 0 ? (
            <li role="presentation" className="p-3 text-sm text-slate-500">
              {users.length ? 'Сотрудники не найдены' : 'Все доступные сотрудники уже добавлены'}
            </li>
          ) : (
            filtered.map((user) => (
              <li
                key={user.id}
                id={`${id}-${user.id}`}
                role="option"
                aria-selected={highlighted?.id === user.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(user.id)}
                className={`flex cursor-pointer items-center gap-2 rounded p-2 text-sm ${highlighted?.id === user.id ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                <UserPlus className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{fullName(user)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
