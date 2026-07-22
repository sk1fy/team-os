# Academy V2 — migration checklist

**Honest status (2026-07-22 rework):** frontend V2 now has functional core flows, but is **not cutover-ready** until pending OpenAPI/read-model contracts and backend E2E are closed. The flag intentionally remains off and legacy implementations remain available for rollback.

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
- `/academy/courses` (+ workspace, versioned builder, lifecycle, assignments and external distribution)
- `/academy/partners` — oversight list/detail (copy/pause/block/resolve)
- `/academy/templates` — gallery, detail, instantiate and corporate draft metadata editor
- `/academy/reports` — owner/admin internal; partner → external scoped report
- `/academy/learners`, campaigns, enrollment report — server-backed registry/report pages
- `/learn/:id` — enrollment player; on 404 resolves legacy **courseId**
- `/learn-opus/:courseId`, `/learn-grok/:courseId` — when V2 on, resolve → enrollment
- preview routes — shared read-only player; full content depends on the learner-safe preview DTO

### Public (when flag on)

- `/training/:token` — landing / verify / activate (deadline **author-set**)
- `/training/enrollments/:enrollmentId` (+ results)

## API surface and contract status

Base: `API_URL` → `/api/v1`

| Area | Paths |
|------|--------|
| Courses | `/academy/courses`, `.../draft`, `.../publish`, archive/restore |
| Restrictions | `/academy/courses/{id}/restrictions/{pause\|block\|resolve}` |
| Copy | `/academy/partner-courses/{id}/versions/{vid}/copy-to-company` |
| Version content | `/academy/course-versions/{vid}/sections\|lessons`, `.../quiz` |
| Templates | `/academy/templates`, instantiate `/academy/template-versions/{vid}/instantiate` |
| Learning (pending OpenAPI read models) | `/academy/learning/me`, `/academy/catalog`, `/academy/enrollments/...` |
| Quiz | `POST .../quizzes/{id}/attempts` → **`{ attempt, enrollment }` atomic** |
| Public | `/public/academy/access/{token}`, verifications, enrollments |
| Reports explicitly in backend plan | enrollment, campaign, course external and partner courses report endpoints |
| Reports pending OpenAPI read models | `/academy/reports/internal`, `/academy/reports/external` (partner) |

See `src/api/academy/`.

## Auth modes

```ts
authMode: 'internal' | 'external' | 'none'
```

- **internal** — Bearer + refresh  
- **external** — cookies only, **no** internal Bearer, no refresh  
- **none** — public pre-session, **no** Bearer, no refresh  

## Query keys

- Use `coursesRoot` and `templatesRoot` for prefix invalidation of all filtered lists.
- Legacy `academy` / `academyOpus` / `academyGrok` remain until Phase 10.

## Phases (honest)

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Contracts / flag / matrix | **partial** | flag and role matrix done; proposed read models/DTOs need OpenAPI approval |
| 1 Foundation types/API/layout | **mostly done** | auth modes, query roots, lazy route structure and capabilities implemented |
| 2 Internal learning + player | **mostly done** | URL resume, atomic quiz, explicit feedback continuation; needs backend E2E |
| 3 Company management + builder | **partial** | versioned builder, DnD, draft creation, lifecycle and basic assignment UI; KB picker/full preview contract pending |
| 4 Partner workspace | **mostly done** | scoped courses, personal accesses and promo campaigns; needs backend E2E |
| 5 Partner oversight + copy | **mostly done** | detail/copy/pause/block/resolve and read-only preview; needs backend E2E |
| 6 Templates | **partial** | gallery/detail/instantiate/archive and draft metadata editor; version-content editor contract pending |
| 7 External learner | **mostly done** | identification/verification/activation/player/results/registry/timeline implemented |
| 8 Campaigns + analytics | **partial** | create/lifecycle/report/funnel UI implemented; analytics contract/E2E pending |
| 9 Cutover | **not done** | flag wiring only; default off; legacy code still in bundle |
| 10 Cleanup | **not done** | do not delete Opus/Grok yet |

## Known gaps (do not claim ready)

- OpenAPI for learning/catalog/resolver/internal and partner report read models
- Learner-safe preview content DTO (outline-only fallback is implemented)
- Full corporate template version-content editor DTO/commands
- Replace raw assignment target ID with a server-backed employee/department/position picker
- KB reuse import
- Rich-text media upload through the files API and the production base64 ban (files contract pending)
- Anonymous legacy `/learn/:courseId` without a token needs a backend compatibility contract
- Confirm `DELETE .../course-version-lessons/{lessonId}/quiz` in OpenAPI
- Full component/E2E/axe coverage (contract adapter tests and role-matrix tests exist)

## Review fixes applied (post-review)

1. **P0** Public API no longer attaches internal Bearer (`authMode`).
2. **P1** Explicit core resource paths aligned; proposed read models are now labelled pending rather than “done”.
3. **P1** External learner cannot pick `deadlineDays` — display + activate only.
4. **P1** `/learn/:id` enrollment-first + courseId resolve; opus/grok learn redirect when V2.
5. **P1** Quiz submit expects atomic `{ attempt, enrollment }`; no separate complete after pass.
6. **P1** Catalog uses enroll mutation (employee-safe).
7. **P1** Partner reports use external report endpoint, not internal.
8. **P1** Course list invalidation uses `coursesRoot` prefix.
9. **P1** Template builder route no longer mounts course builder with wrong param.
10. **P2** Checklist no longer marks Phase 9 as done.

## Second review fixes applied

- External deadline timer switches an open player to read-only and refetches server state.
- Public enrollment and outline use separate backend resources; locked URL lessons are not fetched.
- External identification, resend/change-email, privacy copy, typed results and lifecycle callouts are implemented.
- Activation/copy/assignment/access/campaign critical POST flows send idempotency keys.
- Builder supports new draft creation, `?lesson=`, DnD/cross-section move, keyboard fallback and quiz removal.
- Quiz success feedback remains inline until an explicit continue action.
- Partner route denial shows 403 instead of redirecting to another forbidden route.
- Company/partner management lists are owner-scoped; catalog and learner lists paginate.
- Learners, timeline, campaign funnel, enrollment report, lifecycle and distribution pages are server-backed.
- Progress/radio/lesson-title/mobile navigation accessibility findings were addressed.
- Rich-text link/image insertion uses validated modals instead of `window.prompt`; images include alt text.

## Rollback

1. `VITE_ACADEMY_V2=false`
2. Redeploy
3. Legacy `/academy` + Opus/Grok remain

## Pending backend/OpenAPI contracts

Do not client-join production reports from raw entities:

- `GET /academy/learning/me`
- `GET /academy/catalog`
- `GET /academy/reports/internal`
- `GET /academy/reports/external` (partner)
- `GET /academy/courses/{courseId}/my-enrollment` legacy resolver
- `GET /academy/courses/{courseId}/draft`, learner-version and template-preview reads
- learner-safe version/draft preview content
- template draft/version content response shapes
- verification/session/outline/results response schemas
- quiz deletion command
