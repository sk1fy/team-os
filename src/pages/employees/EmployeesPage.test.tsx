import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { EmployeesPage } from './EmployeesPage';

describe('EmployeesPage', () => {
  it('скрывает действие добавления сотрудника', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/employees']}>
          <EmployeesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(html).not.toContain('Добавить сотрудника');
    expect(html).not.toContain('Настроить сотрудников в графике');
    expect(html).toContain('Последний вход');
    expect(html).toContain('Активен');
    // Вкладки раздела (в т. ч. «Оргструктура») теперь в панели раздела каркаса,
    // а «Тариф и доступ» — в Настройках.
    expect(html).not.toContain('Тариф и доступ');
  });
});
