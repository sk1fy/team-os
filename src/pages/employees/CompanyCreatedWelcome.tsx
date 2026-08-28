import { Building2, ShieldCheck, UserRoundCheck, UsersRound } from 'lucide-react';
import type { ImportedUsersSummary } from './companyCreatedWelcomeState';

interface CompanyCreatedWelcomeProps {
  companyName?: string;
  summary?: ImportedUsersSummary;
  loading: boolean;
  failed: boolean;
}

const counters = [
  { key: 'owners', label: 'Владельцы', icon: Building2 },
  { key: 'admins', label: 'Администраторы', icon: ShieldCheck },
  { key: 'employees', label: 'Сотрудники', icon: UsersRound },
  { key: 'deactivated', label: 'Деактивированы', icon: UserRoundCheck },
] as const;

export function CompanyCreatedWelcome({
  companyName,
  summary,
  loading,
  failed,
}: CompanyCreatedWelcomeProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {companyName && !loading ? (
          <>
            Компания <span className="font-semibold">«{companyName}»</span> успешно создана.
          </>
        ) : (
          'Компания успешно создана.'
        )}{' '}
        Сотрудники из amoCRM импортированы в TeamOS.
      </div>

      {loading && <p className="text-sm text-slate-500">Загружаем сведения о сотрудниках…</p>}

      {!loading && failed && (
        <p className="text-sm text-amber-700">
          Не удалось загрузить статистику сотрудников. Компания уже создана — данные можно
          проверить в списке на этой странице.
        </p>
      )}

      {!loading && !failed && summary && (
        <>
          <p className="text-sm text-slate-600">
            Всего импортировано: <span className="font-semibold text-slate-900">{summary.total}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {counters.map(({ key, label, icon: Icon }) => (
              <div key={key} className="rounded-lg border border-slate-200 p-3">
                <Icon className="mb-2 size-4 text-primary-600" aria-hidden="true" />
                <div className="text-xl font-semibold text-slate-900">{summary[key]}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-sm text-slate-500">
        Роли и доступ сотрудников можно проверить и изменить в разделе «Сотрудники».
      </p>
    </div>
  );
}
