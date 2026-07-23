# TeamOS

Русскоязычное SPA для управления компанией: оргструктура и сотрудники, база знаний, канбан-задачи, академия (курсы и уроки), графики работы, распределение сделок, уведомления.

**Стек:** React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query 5, Zustand, React Router 7, Radix UI, TipTap, dnd-kit.

## Запуск

```sh
npm install
npm run dev        # dev-сервер Vite на http://localhost:5173
```

Другие команды:

```sh
npm run build      # typecheck (tsc -b) + прод-сборка
npm run lint       # ESLint
npm test           # Vitest (юнит-тесты доменной логики и API)
npm run format     # Prettier
```

## Мок-API и переход на реальный бэкенд

По умолчанию приложение работает **без бэкенда**: `src/api/fixtures.ts` — in-memory «база», `mockRequest()` в `src/api/client.ts` симулирует задержку 300–500 мс и 5% случайных ошибок. Перезагрузка страницы сбрасывает данные.

Каждый модуль можно по отдельности переключить на реальный HTTP-бэкенд через переменные окружения (см. `.env.example`):

```sh
VITE_API_URL=http://localhost:8080/api/v1
VITE_API_MODE_AUTH=http        # auth | org | kb | tasks | academy | notifications | schedule | distribution
```

Сигнатуры функций в `src/api/index.ts` — контракт с бэкендом: HTTP-реализации в `src/api/http.ts` повторяют их один в один.

### Academy V2

Единая Академия (план `teamos-academy-frontend-plan.md`) включается флагом:

```sh
VITE_ACADEMY_V2=true
```

По умолчанию (`false`) `/academy` остаётся legacy-страницей. При `true`:

- канонические маршруты `/academy/*`, player `/learn/:enrollmentId`;
- публичный external flow `/training/:token`;
- API adapters в `src/api/academy/` (`/academy/*` относительно `/api/v1`);
- query keys: `queryKeys.academyV2`, `queryKeys.externalAcademy`.

Экспериментальные Opus/Grok остаются до cutover (Phase 9). Чеклист миграции:
`docs/academy-v2-migration-checklist.md`.

### Текущие интеграции Rakurs

Разделы «Контроль активности» и «Автопоиск дубликатов» временно обращаются напрямую к
действующим сервисам Rakurs. URL задаются через `VITE_RAKURS_ACTIVITY_API_URL`,
`VITE_RAKURS_DUPLICATES_API_URL` и `VITE_RAKURS_ACCOUNT_API_URL`. Идентификатор amoCRM берётся
из настроек компании (`amoAccountId`); тестовые значения из старых виджетов не используются.

Клиенты интеграций изолированы в `src/api/rakurs/`, чтобы при переносе backend на микросервисы
заменить транспорт без изменения страниц и моделей форм.

## Структура

- `src/api/` — мок- и HTTP-клиенты, фикстуры, фабрика query-ключей (`queryKeys.ts`)
- `src/lib/` — чистая доменная логика с юнит-тестами
- `src/components/ui/` — дизайн-система на Radix-примитивах
- `src/pages/<module>/` — страницы по модулям, роуты в `src/App.tsx`
- `src/stores/` — клиентское UI-состояние (Zustand)

Подробные соглашения для разработки — в [CLAUDE.md](CLAUDE.md).
