import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompanyCreatedWelcome } from './CompanyCreatedWelcome';

describe('CompanyCreatedWelcome', () => {
  it('не показывает потенциально устаревшую статистику во время загрузки', () => {
    const html = renderToStaticMarkup(
      <CompanyCreatedWelcome
        companyName="Старая компания"
        summary={{ total: 99, owners: 1, admins: 10, employees: 88, deactivated: 0 }}
        loading
        failed={false}
      />,
    );

    expect(html).toContain('Загружаем сведения о сотрудниках');
    expect(html).not.toContain('Старая компания');
    expect(html).not.toContain('Всего импортировано');
  });

  it('показывает название компании и фактическую статистику импорта', () => {
    const html = renderToStaticMarkup(
      <CompanyCreatedWelcome
        companyName="Ромашка"
        summary={{ total: 12, owners: 1, admins: 2, employees: 8, deactivated: 1 }}
        loading={false}
        failed={false}
      />,
    );

    expect(html).toContain('Компания <span class="font-semibold">«Ромашка»</span> успешно создана');
    expect(html).toContain('Всего импортировано:');
    expect(html).toContain('Администраторы');
    expect(html).toContain('Деактивированы');
  });

  it('не скрывает успешное создание при ошибке загрузки статистики', () => {
    const html = renderToStaticMarkup(
      <CompanyCreatedWelcome loading={false} failed summary={undefined} />,
    );

    expect(html).toContain('Компания успешно создана');
    expect(html).toContain('Не удалось загрузить статистику сотрудников');
  });
});
