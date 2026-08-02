import type { MouseEvent } from 'react';

interface EmployeeOpenButtonProps {
  name: string;
  onOpen: () => void;
}

export function EmployeeOpenButton({ name, onOpen }: EmployeeOpenButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpen();
  };

  return (
    <button
      type="button"
      aria-label={`Открыть карточку: ${name}`}
      onClick={handleClick}
      className="truncate rounded-sm text-left text-sm font-medium text-slate-900 hover:text-primary-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      {name}
    </button>
  );
}
