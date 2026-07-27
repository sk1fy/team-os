# Academy frontend QA — 27 июля 2026

## Итог

**Текущий frontend head: PASS для внутренних staging-сценариев.**

**Production cutover: BLOCKED.**

Новый frontend проверен браузером против реального backend
`http://31.76.42.128:8080/api/v1`. Для этого текущий workspace head запускался локально через
Vite с proxy на staging API: опубликованный на `:8080` статический frontend ещё не содержит
исправления этого набора.

Полный real-backend browser suite: **3/3 PASS, 35,7 с**.

Общий production PASS пока нельзя ставить по двум причинам:

1. полный external learner flow на реальном backend требует кода из synthetic mailbox, доступ к
   которому в текущем окружении не предоставлен;
2. новый machine-readable landing contract должен быть закоммичен и развёрнут вместе с backend,
   после чего нужно повторить external test и только затем включать V2 по умолчанию.

## Автоматические проверки

| Проверка                                         | Результат                                            |
| ------------------------------------------------ | ---------------------------------------------------- |
| ESLint                                           | PASS: 0 errors, 5 существующих Fast Refresh warnings |
| Vitest                                           | PASS: 39 files, 269 tests                            |
| Production build                                 | PASS                                                 |
| OpenAPI schema drift                             | PASS против локального backend contract              |
| Browser E2E с точным fixture wire contract       | PASS: 13/13                                          |
| Browser E2E текущего head против staging backend | PASS: 3/3                                            |
| Cleanup staging test data                        | PASS: 0 тестовых users, 0 тестовых courses           |

## Что подтверждено реальным backend

### Role matrix

- owner: Academy navigation и административные разделы;
- admin: Academy navigation и административные разделы;
- employee: learner navigation, отсутствие административного меню, запрет прямого admin route;
- partner: partner navigation, отсутствие чужого partner-admin route;
- axe WCAG 2 A/AA scan на проверяемых конечных страницах;
- временные пользователи создаются через реальный API, получают пароль и удаляются в `finally`.

### Course lifecycle

- создание курса через UI;
- открытие versioned builder;
- создание урока и rich-text content;
- загрузка PNG через реальный files service;
- сохранение урока;
- публикация immutable `v1`;
- проверка workspace;
- удаление курса и fallback cleanup через API.

### Knowledge base

- выбор реальной KB-статьи в create-course flow;
- создание linked company course;
- сохранение `sourceArticleId`, `sourceArticleVersionId` и `kb_link`;
- cleanup созданного курса.

## External learner

Браузерный fixture suite теперь использует backend-oriented wire shape, разные ID draft и
published versions и настоящий Chromium. Подтверждены:

- landing → OTP request → неверный код → retry → activation;
- два урока, completion и results;
- already-activated enrollment;
- axe scan;
- все machine-readable unavailable states:
  `distribution_paused`, `course_blocked`, `course_archived`, `course_deleted`,
  `access_revoked`, `access_expired`, `campaign_paused`, `campaign_revoked`,
  `campaign_closed`, `version_unavailable`, `unavailable`.

Это полноценный browser E2E frontend flow, но не заменяет реальный SMTP/outbox test. Backend
runbook прямо требует synthetic mailbox для staging OTP sign-off; такого доступа в текущих
credentials нет.

## Закрытые пункты аудита

| Область                                       | Статус текущего head                         |
| --------------------------------------------- | -------------------------------------------- |
| Playwright browser E2E и запуск в CI          | PASS                                         |
| Точный external fixture wire contract         | PASS                                         |
| Разные draft/published version IDs            | PASS                                         |
| Machine-readable public landing states        | PASS в коде; ждёт совместного backend deploy |
| Company template content builder              | PASS                                         |
| KB import                                     | PASS                                         |
| Rich-text files upload/progress/retry         | PASS                                         |
| External registry UI pagination               | PASS                                         |
| Generated OpenAPI request/response/enum types | PASS                                         |
| Real backend owner/admin/employee/partner     | PASS                                         |
| Real backend course lifecycle/files/KB        | PASS                                         |
| Real backend external OTP                     | BLOCKED: нет synthetic mailbox               |
| Production cutover                            | BLOCKED до пункта выше                       |
| Legacy cleanup                                | После подтверждённого cutover                |

`paginateArray` теперь действительно фильтрует и делает `slice`, поэтому одинаковый полный массив
больше не показывается на каждой странице. Однако backend compatibility endpoints по-прежнему могут
возвращать полный массив; для больших реестров серверная фильтрация/пагинация остаётся backend
performance work, а не frontend release blocker.

## CI

- основной workflow устанавливает Playwright Chromium и запускает external browser suite;
- при падении загружаются trace/screenshots;
- отдельный staging workflow использует environment secrets и запускает real-backend suite;
- отдельный contract workflow генерирует типы из backend OpenAPI и падает при schema drift.

Contract workflow станет зелёным в удалённом CI после попадания текущего backend OpenAPI contract в
ветку, которую checkout-ит workflow.

## Решение по релизу

Изменения можно разворачивать на staging. После совместного frontend/backend deploy необходимо:

1. предоставить CI synthetic mailbox или безопасный OTP test harness;
2. пройти реальный personal-access и campaign external lifecycle;
3. повторить axe на развёрнутом frontend;
4. только после этого включить `VITE_ACADEMY_V2` по умолчанию;
5. удалить legacy Academy/Opus/Grok и старые query trees отдельным cleanup change.

До выполнения этих шагов правильный статус: **staging-ready, production-cutover blocked**.
