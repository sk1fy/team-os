import { describe, expect, it, vi } from 'vitest';
import { EmployeeOpenButton } from './EmployeeOpenButton';

describe('EmployeeOpenButton', () => {
  it('exposes an explicitly named keyboard control and does not bubble its click to the row', () => {
    const onOpen = vi.fn();
    const stopPropagation = vi.fn();
    const element = EmployeeOpenButton({ name: 'Анна Смирнова', onOpen });

    expect(element.type).toBe('button');
    expect(element.props.type).toBe('button');
    expect(element.props['aria-label']).toBe('Открыть карточку: Анна Смирнова');

    element.props.onClick({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
