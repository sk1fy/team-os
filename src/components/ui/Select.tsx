import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useId, type Ref } from 'react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  triggerRef?: Ref<HTMLButtonElement>;
}

function SelectItem({ option }: { option: SelectOption }) {
  return (
    <SelectPrimitive.Item
      value={option.value}
      disabled={option.disabled}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-sm text-slate-700 outline-none select-none',
        'data-[highlighted]:bg-slate-100',
        'data-[disabled]:cursor-not-allowed data-[disabled]:text-slate-300',
      )}
    >
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4 text-primary-600" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Выберите…',
  label,
  disabled,
  className,
  error,
  triggerRef,
}: SelectProps) {
  const errorId = useId();
  const labelId = useId();
  const ungroupedOptions = options.filter((option) => !option.group);
  const groupedOptions = new Map<string, SelectOption[]>();
  for (const option of options) {
    if (!option.group) continue;
    const group = groupedOptions.get(option.group) ?? [];
    group.push(option);
    groupedOptions.set(option.group, group);
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span id={labelId} className="text-xs font-semibold text-slate-700">
          {label}
        </span>
      )}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          ref={triggerRef}
          aria-labelledby={label ? labelId : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'flex h-9.5 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border bg-surface px-3 text-sm',
            'focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            'data-[placeholder]:text-slate-400',
            error ? 'border-danger-500' : 'border-slate-200',
          )}
        >
          <span
            className="min-w-0 flex-1 truncate text-left"
            title={options.find((option) => option.value === value)?.label}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
          </span>
          <SelectPrimitive.Icon className="shrink-0">
            <ChevronDown className="size-4 text-slate-400" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="animate-popover-in z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-y-auto rounded-md border border-slate-200 bg-surface p-1 shadow-popover"
          >
            <SelectPrimitive.Viewport>
              {ungroupedOptions.map((option) => (
                <SelectItem key={option.value} option={option} />
              ))}
              {ungroupedOptions.length > 0 && groupedOptions.size > 0 && (
                <SelectPrimitive.Separator className="my-1 h-px bg-slate-100" />
              )}
              {[...groupedOptions.entries()].map(([groupName, groupOptions]) => (
                <SelectPrimitive.Group key={groupName}>
                  <SelectPrimitive.Label className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                    {groupName}
                  </SelectPrimitive.Label>
                  {groupOptions.map((option) => (
                    <SelectItem key={option.value} option={option} />
                  ))}
                </SelectPrimitive.Group>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
