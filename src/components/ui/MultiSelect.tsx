import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder: string;
  formatCount: (count: number) => string;
  className?: string;
}

export function MultiSelect({
  options,
  values,
  onValuesChange,
  placeholder,
  formatCount,
  className,
}: MultiSelectProps) {
  const selected = new Set(values);
  const label = values.length === 0 ? placeholder : formatCount(values.length);

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onValuesChange([...next]);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'flex h-9.5 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-surface px-3 text-sm',
          'focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600',
          values.length === 0 && 'text-slate-500',
          className,
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="animate-popover-in z-50 max-h-72 min-w-(--radix-dropdown-menu-trigger-width) overflow-y-auto rounded-md border border-slate-200 bg-surface p-1 shadow-popover"
        >
          {options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={option.value}
              checked={selected.has(option.value)}
              onCheckedChange={() => toggle(option.value)}
              onSelect={(event) => event.preventDefault()}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-slate-700 outline-none select-none',
                'data-[highlighted]:bg-slate-100',
              )}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4 text-primary-600" />
                </DropdownMenu.ItemIndicator>
              </span>
              <span className="truncate">{option.label}</span>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
