import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { EmployeesPage } from './EmployeesPage';

describe('EmployeesPage', () => {
  it('показывает доступное действие добавления сотрудника', () => {
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

    expect(html).toContain('<button');
    expect(html).toContain('Добавить сотрудника');
  });
});
