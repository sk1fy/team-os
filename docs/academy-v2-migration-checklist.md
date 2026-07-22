# Academy V2 — migration checklist

## Feature flag

| Flag | Default | Effect |
|------|---------|--------|
| `VITE_ACADEMY_V2` | `false` / empty | `false` — legacy `AcademyPage` on `/academy` |
| | `true` / `1` / `on` | V2 layout, routes, enrollment player |

Opus/Grok experimental routes stay registered until Phase 9 cutover.

## Route map

### Authenticated (V2)

- `/academy` — Моё обучение
- `/academy/catalog`
- `/academy/courses` (+ `/:courseId`, builder, versions, distribution, reports)
- `/academy/partners`, `/academy/partners/:partnerId`
- `/academy/templates`, `/academy/templates/:templateId` (+ builder)
- `/academy/reports`
- `/academy/learners`, `/academy/learners/:learnerId`
- `/academy/campaigns/:campaignId`
- `/academy/enrollments/:enrollmentId/report`
- `/learn/:enrollmentId` — internal player
- `/academy/preview/course-versions/:versionId`
- `/academy/preview/drafts/:draftVersionId`

### Public (later phases)

- `/training/:token`
- `/training/enrollments/:enrollmentId`
- `/training/enrollments/:enrollmentId/results`

### Legacy (until Phase 9–10)

- `/academy-opus`, `/academy-grok/*`
- `/learn-opus/:courseId`, `/learn-grok/:courseId`
- Legacy learn-by-courseId → resolver when V2 enabled (`/learn-legacy/:courseId` scaffold)

## Query keys

- New: `queryKeys.academyV2.*`, `queryKeys.externalAcademy.*`
- Keep: `queryKeys.academy`, `academyOpus`, `academyGrok` until cleanup

## API surface (frontend adapters)

Prefix: `/academy/v2/...` and `/public/training/...`

See `src/api/academy/`.

## Phases

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Contracts / flag / matrix | done | this branch |
| 1 Foundation types/API/layout | done | scaffold pages |
| 2 Internal learning + player | pending | real lesson/quiz |
| 3 Company management + builder | pending | |
| 4 Partner workspace | pending | |
| 5 Partner oversight + copy | pending | |
| 6 Templates | pending | |
| 7 External learner | pending | needs backend identity |
| 8 Campaigns + analytics | pending | |
| 9 Cutover | pending | sidebar single Academy |
| 10 Cleanup | pending | delete Opus/Grok |

## Rollback

1. Set `VITE_ACADEMY_V2=false` (or remove).
2. Redeploy frontend.
3. Legacy `/academy` and experiment routes remain intact.

## Missing backend read models (do not client-join)

- `GET /academy/v2/my-learning`
- `GET /academy/v2/catalog`
- `GET /academy/v2/reports/internal`
- course management list summary
- partner grouping summary
