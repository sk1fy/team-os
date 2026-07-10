import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
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
}: SelectProps) {
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
      {label && <span className="text-xs font-semibold text-slate-700">{label}</span>}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-9.5 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-surface px-3 text-sm',
            'focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            'data-[placeholder]:text-slate-400',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
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
    </div>
  );
}
