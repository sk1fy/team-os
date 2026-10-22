# Документация TeamOS

## Контроль задач

- [ADR КТ-01.01](../../amocrm-pro/docs/adr/0038-task-control-hybrid-integration.md) —
  каноническое решение в соседнем репозитории Core: блок в Интеграциях и отдельные права,
  редактор/импорт/публикация через company, автономный режим виджета.
  Согласовано 2026-10-15; контракты подготовлены, реализация UI впереди.
  [Копия решения в ClickUp](https://app.clickup.com/t/869fhtvty).

- [Модель и API КТ-01.02](../../team-os-backend/docs/integrations/task-control-contract.md).

## Распределение

- [Наблюдение и пилот](distribution/rs10-observe-pilot.md) —
  текущий режим observe, ограничения и внешняя приёмка.

Открытые внешние проверки сохранены в инструкции пилота. Синтетические
UI-тесты не подтверждают живой amoCRM.
Общие запуск и режимы API — в [README](../README.md).

## GitHub CI и проверка staging

[Основной CI](../.github/workflows/ci.yml) запускает lint, unit-тесты,
сборку и локальные браузерные проверки на push в main и pull request.
[Проверка OpenAPI](../.github/workflows/academy-contract.yml) отдельно сверяет
сгенерированные типы с backend; при изменении контракта выполните
`npm run contract:generate -- ../team-os-backend/contracts/openapi/teamos.yaml`
и `npm run contract:check`.

[Academy staging browser QA](../.github/workflows/academy-staging.yml) проверяет
уже работающий тестовый backend и запускается вручную. Публикации приложения
в нём нет. Привязка к environment удалена, ручная QA больше не создаёт Deployments.
Автоматическое расписание удалено: 62 запуска до 21.10.2026 падали без настроек
стенда. 22.10.2026 workflow временно отключён на GitHub, состояние — `disabled_manually`.

Для включения сначала опубликуйте в main версию workflow без расписания.
В Settings → Secrets and variables → Actions репозитория задайте variables
`ACADEMY_BASE_URL`, `ACADEMY_API_URL` и secrets `ACADEMY_OWNER_EMAIL`,
`ACADEMY_OWNER_PASSWORD`.
Используйте отдельного тестового owner: сценарии создают тестовых пользователей
и курсы, затем удаляют их. После настройки включите и запустите проверку:

```sh
gh workflow enable academy-staging.yml --repo sk1fy/team-os
gh workflow run academy-staging.yml --repo sk1fy/team-os
```

До обновления main включение workflow вернёт прежнее будничное расписание.

Сквозной MVP Контроля задач: [порядок выкладки и пилотной проверки](https://github.com/sk1fy/amocrm-pro/blob/codex/task-control-mvp/docs/runbooks/task-control-mvp.md).
Редактор доступен в Интеграции → Контроль задач. В MVP CRM IDs вводятся вручную,
подключение и смена режима подтверждаются одноразовым кодом из amoCRM.
