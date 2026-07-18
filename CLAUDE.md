# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev        # Vite dev server on port 5173
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm test           # vitest run (all tests)
npx vitest run src/lib/schedule.test.ts   # single test file
npm run format     # Prettier over src/**/*.{ts,tsx,css}
```

## What this is

TeamOS — a Russian-language company-management SPA (org structure, employees, knowledge base, kanban tasks, academy/courses, work schedules, notifications). React 19 + TypeScript + Vite, Tailwind CSS 4, TanStack Query 5, Zustand, React Router 7, Radix UI primitives, TipTap for rich text, dnd-kit for drag-and-drop.

**Everything user-facing is in Russian** — UI copy, error messages, code comments. Keep it that way.

## Architecture

### Dual API: mock by default, per-module HTTP backend via env flags

- [src/api/config.ts](src/api/config.ts) — each module is independently switched between mock and HTTP with `VITE_API_MODE_<MODULE>=http` (see `.env.example`); the default is the offline mock demo. [src/api/index.ts](src/api/index.ts) picks the implementation per module at build time.
- [src/api/client.ts](src/api/client.ts) — both clients live here. `mockRequest()` wraps mock calls with a 300–500 ms delay and a **5% random error rate** (both disabled under Vitest), so all UI must handle loading and error states; `structuredClone` on the way out protects fixtures from component mutation; `{ noFail: true }` is used for critical queries (current user, unread count). `httpRequest()` is the gateway client: bearer token from [src/stores/auth.ts](src/stores/auth.ts), refresh-cookie rotation with one transparent retry after 401, SSE via `openEventStream`.
- [src/api/fixtures.ts](src/api/fixtures.ts) — in-memory mutable "database" (plain exported arrays). API mutations mutate these arrays, so data behaves realistically within a session; a reload resets everything.
- [src/api/index.ts](src/api/index.ts) — request functions grouped by module: `authApi`, `orgApi`, `kbApi`, `tasksApi`, `academyApi`, `notificationsApi`, `scheduleApi`, `distributionApi`. **Function signatures are the contract with the backend** — HTTP implementations in [src/api/http.ts](src/api/http.ts) mirror the mock signatures exactly; never change signatures, only implementations. Domain errors are thrown as `ApiError` with Russian messages; use `notFound('Сущность')` for missing ids.
- [src/types/index.ts](src/types/index.ts) — all entity types in one file; same contract status as the API signatures.

### State management split

- **Server data lives only in TanStack Query.** [src/api/queryClient.ts](src/api/queryClient.ts) retries up to 2 times via `shouldRetryQuery` (absorbs the mock error rate and real network flakes; 4xx errors are never retried), `staleTime: 30_000`, no refetch on window focus.
- **Query keys come from the factory in [src/api/queryKeys.ts](src/api/queryKeys.ts)** (`queryKeys.kb.articles`, `queryKeys.academy.lessonsFor(courseId)`, `queryKeys.tasks.columns(boardId)`…). Keys are hierarchical arrays, so invalidation-by-prefix works (e.g. `queryKeys.academy.all`). Never write key arrays inline — add new keys to the factory.
- **Client UI state lives in Zustand**: [src/stores/ui.ts](src/stores/ui.ts) (theme, sidebar, global department filter; persisted as `teamos-ui`) and [src/stores/toast.ts](src/stores/toast.ts). The `toast.success/error/info` helpers work outside components — use them in mutation callbacks.

### Domain logic and tests

Pure business rules live in [src/lib/](src/lib) (`orgTree.ts` — department tree building and move validation, `inviteRules.ts`, `userGuards.ts` — role/status change guards, `schedule.ts` — shift calendar math). The mock API calls these for validation. Unit tests (colocated `*.test.ts`, Vitest) cover `src/lib/` and parts of `src/api/`; components have no tests. New non-trivial domain rules belong here with tests, not inline in components or the API.

### UI layers

- `src/components/ui/` — Radix-based design-system primitives, re-exported via `index.ts`.
- `src/components/layout/` — app shell (`AppLayout` with sidebar/topbar, `AuthLayout`), plus shared `EmptyState` / `ErrorState` / `ErrorBoundary`.
- `src/components/rich-text/` — TipTap editor and read-only view. Rich content is stored as **TipTap JSON** (`RichTextContent`), never HTML; helpers in `src/lib/richText.ts`.
- `src/pages/<module>/` — one directory per module; routes wired in [src/App.tsx](src/App.tsx). Main app under `AppLayout`, auth flows under `/auth`, and `/learn/:courseId` is a standalone full-screen course player outside both layouts.

### Other conventions

- Path alias `@/` → `src/` (both in Vite config and tsconfig).
- Auth: in mock mode the session is simulated (`CURRENT_USER_ID` in fixtures, persisted to storage); in HTTP mode it's a real JWT kept in memory only ([src/stores/auth.ts](src/stores/auth.ts)) with refresh-cookie rotation handled by `httpRequest`.
- Cross-module links are a feature, not an accident: Academy lessons can `link` to knowledge-base articles (content stays live-synced via `withLiveContent`) or `copy` them; positions reference required courses and regulation articles.
- Prettier: single quotes, semicolons, trailing commas, 100-char width. `eslint-config-prettier` is applied — don't hand-format against it.
