import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DropdownItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface DropdownProps {
  /** Элемент-триггер (кнопка, аватар и т.п.). */
  trigger: ReactNode;
  items: (DropdownItem | 'separator')[];
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function Dropdown({ trigger, items, align = 'end', className }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className={cn(
            'animate-popover-in z-50 min-w-48 rounded-md border border-slate-200 bg-surface p-1 shadow-popover',
            className,
          )}
        >
          {items.map((item, index) =>
            item === 'separator' ? (
              <DropdownMenu.Separator
                key={`separator-${index}`}
                className="my-1 h-px bg-slate-200"
              />
            ) : (
              <DropdownMenu.Item
                key={item.key}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm outline-none select-none',
                  'data-[disabled]:cursor-not-allowed data-[disabled]:text-slate-300',
                  item.danger
                    ? 'text-danger-600 data-[highlighted]:bg-danger-50'
                    : 'text-slate-700 data-[highlighted]:bg-slate-100',
                )}
              >
                {item.icon && <item.icon className="size-4" />}
                {item.label}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
