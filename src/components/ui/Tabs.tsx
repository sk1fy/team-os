import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  hideTrigger?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  className?: string;
}

export function Tabs({ items, value, onValueChange, defaultValue, className }: TabsProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      defaultValue={defaultValue ?? items[0]?.value}
      className={className}
    >
      <TabsPrimitive.List className="inline-flex flex-wrap gap-1 rounded-md bg-surface-sunken p-1">
        {items.filter((item) => !item.hideTrigger).map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              'cursor-pointer rounded-[9px] px-4 py-1.5 text-sm font-semibold text-slate-500 transition-colors',
              'hover:text-slate-700',
              'data-[state=active]:bg-surface data-[state=active]:text-primary-600 data-[state=active]:shadow-[0_1px_2px_rgba(10,19,20,0.08)]',
              'disabled:cursor-not-allowed disabled:text-slate-300',
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value} className="pt-4 outline-none">
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
