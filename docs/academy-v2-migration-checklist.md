# Academy V2 — migration checklist

**Honest status (2026-07-22 review):** frontend is a **partial V2 scaffold**, not cutover-ready.  
Useful foundation exists (types, role matrix, capabilities, player shell, builder, reports UI).  
Many product flows are incomplete or were overstated as “done”.

## Feature flag

| Flag | Default | Effect |
|------|---------|--------|
| `VITE_ACADEMY_V2` | `false` / empty | legacy `AcademyPage` on `/academy` |
| | `true` / `1` / `on` | V2 routes under `/academy`, learn entry, public `/training` |

Default stays **off**. Enabling the flag does **not** remove Opus/Grok bundles from the build until Phase 10 cleanup.

## Route map

### Authenticated (V2, when flag on)

- `/academy` — Моё обучение
- `/academy/catalog` — enroll via `POST /academy/catalog/:id/enroll` (not course workspace)
- `/academy/courses` (+ workspace, builder, versions, distribution shells)
- `/academy/partners` — oversight list (copy/pause/block)
- `/academy/templates` — gallery (template **builder** is still a placeholder)
- `/academy/reports` — owner/admin internal; partner → external scoped report
- `/academy/learners`, campaigns, enrollment report — **placeholders**
- `/learn/:id` — enrollment player; on 404 resolves legacy **courseId**
- `/learn-opus/:courseId`, `/learn-grok/:courseId` — when V2 on, resolve → enrollment
- preview routes — **scaffold shell only**

### Public (when flag on)

- `/training/:token` — landing / verify / activate (deadline **author-set**)
- `/training/enrollments/:enrollmentId` (+ results)

## API surface (aligned with backend plan §11)

Base: `API_URL` → `/api/v1`

| Area | Paths |
|------|--------|
| Courses | `/academy/courses`, `.../draft`, `.../publish`, archive/restore |
| Restrictions | `/academy/courses/{id}/restrictions/{pause\|block\|resolve}` |
| Copy | `/academy/partner-courses/{id}/versions/{vid}/copy-to-company` |
| Version content | `/academy/course-versions/{vid}/sections\|lessons`, `.../quiz` |
| Templates | `/academy/templates`, instantiate `/academy/template-versions/{vid}/instantiate` |
| Learning | `/academy/learning/me`, `/academy/catalog`, `/academy/enrollments/...` |
| Quiz | `POST .../quizzes/{id}/attempts` → **`{ attempt, enrollment }` atomic** |
| Public | `/public/academy/access/{token}`, verifications, enrollments |
| Reports | `/academy/reports/internal`, `/academy/reports/external` (partner) |

See `src/api/academy/`.

## Auth modes

```ts
authMode: 'internal' | 'external' | 'none'
```

- **internal** — Bearer + refresh  
- **external** — cookies only, **no** internal Bearer, no refresh  
- **none** — public pre-session, **no** Bearer, no refresh  

## Query keys

- Prefer `queryKeys.academyV2.coursesRoot` for list invalidation (prefix of all filtered lists).
- Legacy `academy` / `academyOpus` / `academyGrok` remain until Phase 10.

## Phases (honest)

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Contracts / flag / matrix | **done** | flag, checklist, role matrix tests |
| 1 Foundation types/API/layout | **mostly done** | authMode fixed; paths aligned to backend plan |
| 2 Internal learning + player | **partial** | player + quiz atomic client contract; needs backend E2E |
| 3 Company management + builder | **partial** | builder/settings/publish/versions; no full assignment UI, preview scaffold |
| 4 Partner workspace | **partial** | list + capabilities; distribution shells incomplete |
| 5 Partner oversight + copy | **partial** | UI for copy/pause/block; needs backend |
| 6 Templates | **partial** | gallery + instantiate; template builder **not** implemented |
| 7 External learner | **partial** | landing/activate/player; no full results/registry UI |
| 8 Campaigns + analytics | **stubs** | API adapters only |
| 9 Cutover | **not done** | flag wiring only; default off; legacy code still in bundle |
| 10 Cleanup | **not done** | do not delete Opus/Grok yet |

## Known gaps (do not claim ready)

- Preview player content
- Learners registry / timeline / campaign report UI
- Personal access management UI
- Assignment create/revoke UI
- Lifecycle archive/restore/delete dialogs
- KB reuse import
- Template builder
- New draft version creation UX
- Full E2E / component tests for adapters

## Review fixes applied (post-review)

1. **P0** Public API no longer attaches internal Bearer (`authMode`).
2. **P1** Paths aligned to backend plan (no `/academy/v2/...` mismatch for core resources).
3. **P1** External learner cannot pick `deadlineDays` — display + activate only.
4. **P1** `/learn/:id` enrollment-first + courseId resolve; opus/grok learn redirect when V2.
5. **P1** Quiz submit expects atomic `{ attempt, enrollment }`; no separate complete after pass.
6. **P1** Catalog uses enroll mutation (employee-safe).
7. **P1** Partner reports use external report endpoint, not internal.
8. **P1** Course list invalidation uses `coursesRoot` prefix.
9. **P1** Template builder route no longer mounts course builder with wrong param.
10. **P2** Checklist no longer marks Phase 9 as done.

## Rollback

1. `VITE_ACADEMY_V2=false`
2. Redeploy
3. Legacy `/academy` + Opus/Grok remain

## Missing backend read models

Do not client-join production reports from raw entities:

- `GET /academy/learning/me`
- `GET /academy/catalog`
- `GET /academy/reports/internal`
- `GET /academy/reports/external` (partner)
- course management summaries / partner grouping
