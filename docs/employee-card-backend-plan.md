# Backend-план: карточка сотрудника, доступы и lifecycle

## Цель

Поддержать новую карточку сотрудника во frontend:

- отдельное управление способом входа;
- индивидуальная видимость продуктовых разделов для `employee`;
- деактивация и восстановление для `local` и `amo`;
- физическое удаление только для `local`;
- исчезновение `amo`-сотрудника после удаления в amoCRM и успешной синхронизации.

Backend находится в `/Users/nikpeskov/Projects/team-os-backend`.

## Что уже реализовано

- `PATCH /api/v1/org/users/{id}` меняет `status` на `active`/`deactivated`.
- Деактивация отзывает refresh-сессии и публикует
  `teamos.org.user.deactivated.v1`.
- `DELETE /api/v1/org/users/{id}` разрешён только для `source=local`;
  для `amo` возвращается `409`.
- Нельзя деактивировать/удалить владельца или собственную учётную запись.
- Password/link/revoke access уже реализован для owner/admin.
- amoCRM sync пока create-only: пользователи, исчезнувшие upstream, не скрываются.

Ключевые файлы backend:

- `contracts/openapi/teamos.yaml`
- `contracts/proto/company/v1/company.proto`
- `contracts/events/org.proto`
- `pkg/auth/claims.go`
- `pkg/auth/token.go`
- `services/company/internal/application/org.go`
- `services/company/internal/application/amo_users.go`
- `services/company/internal/application/access.go`
- `services/company/internal/application/schedule.go`
- `services/company/internal/application/distribution.go`
- `services/company/internal/storage/queries/org.sql`
- `services/company/internal/storage/queries/auth.sql`
- `services/company/migrations/000003_amo_users.up.sql`
- `services/company/migrations/000007_user_profiles_access_audit.up.sql`

## 1. Контракт индивидуальных разделов

Добавить enum:

```text
schedule
knowledge
academy
distribution
```

Правила:

- `owner` и `admin` всегда имеют полный доступ, включая Activity Control и
  Duplicate Search. Индивидуальный набор для них не хранится.
- `employee` получает доступ по `sectionAccess`.
- `partner` сохраняет текущую фиксированную матрицу; `sectionAccess`
  игнорируется и не редактируется.
- default для существующих и новых `employee`:
  `schedule`, `knowledge`, `academy`.

OpenAPI:

```yaml
EmployeeSection:
  type: string
  enum: [schedule, knowledge, academy, distribution]

User:
  properties:
    sectionAccess:
      type: array
      uniqueItems: true
      items:
        $ref: '#/components/schemas/EmployeeSection'

UpdateUserInput:
  properties:
    sectionAccess:
      type: array
      minItems: 1
      maxItems: 4
      uniqueItems: true
      items:
        $ref: '#/components/schemas/EmployeeSection'
```

Frontend использует существующий endpoint:

```http
PATCH /api/v1/org/users/{id}
Content-Type: application/json

{
  "sectionAccess": ["schedule", "knowledge"]
}
```

`GET /auth/me`, `GET /org/users` и `GET /org/users/{id}` должны возвращать
`sectionAccess` для `employee`.

Пустой массив отклоняется: у сотрудника должен оставаться хотя бы один рабочий
раздел.

В protobuf добавить `EmployeeSection`, `repeated EmployeeSection section_access`
в `User`, а в update request — repeated field и presence-флаг
`update_section_access`. После изменений выполнить `make gen`.

## 2. Хранение и миграция

Создать миграцию, например `000008_employee_sections_lifecycle.up.sql`:

```sql
CREATE TABLE employee_section_access (
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section text NOT NULL CHECK (
        section IN ('schedule', 'knowledge', 'academy', 'distribution')
    ),
    granted_by uuid,
    granted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, section)
);

CREATE INDEX employee_section_access_company_user_idx
    ON employee_section_access (company_id, user_id);

INSERT INTO employee_section_access (company_id, user_id, section)
SELECT company_id, id, section
FROM users
CROSS JOIN unnest(ARRAY['schedule', 'knowledge', 'academy']) AS section
WHERE role = 'employee';

ALTER TABLE users ADD COLUMN external_deleted_at timestamptz;
```

`external_deleted_at` — tombstone для amoCRM. Физически удалять такие профили
нельзя: они могут быть связаны с историей других сервисов.

## 3. Application/storage-логика

В одной транзакции `UpdateUser`:

1. Заблокировать target user через `FOR UPDATE` с обязательным `company_id`.
2. Проверить actor: менять sections могут только owner/admin.
3. Вычислить итоговую роль после PATCH.
4. Если `sectionAccess` передан не для `employee`, вернуть `400`.
5. Проверить enum и уникальность.
6. Полностью заменить строки в `employee_section_access`.
7. При переходе в `employee` без явного списка выдать default.
8. При переходе из `employee` в admin/owner/partner удалить grants.
9. Добавить `sectionAccess` в `changedFields` события `org.user.updated`.
10. При изменении sections отозвать refresh-сессии пользователя.

Создание local/amo employee и принятие employee invite должны атомарно создавать
default grants.

## 4. JWT и обязательная серверная авторизация

Добавить claim:

```json
{
  "sec": ["schedule", "knowledge", "academy"]
}
```

- `pkg/auth.Claims`: `SectionAccess []string json:"sec,omitempty"`.
- Загружать grants при password login, refresh и access-link login.
- Для owner/admin full access определяется ролью.
- Для partner claim игнорируется.
- Неизвестное значение claim обрабатывается fail-closed.

Frontend-скрытие меню не является защитой. Проверки нужны в сервисах:

- Schedule: `employee + schedule` — только чтение собственных данных;
  изменение чужих графиков остаётся owner/admin.
- Knowledge: без `knowledge` вернуть `403` до article-level access.
- Academy: без `academy` вернуть `403`; публичные и external training routes не
  менять.
- Distribution: `employee + distribution` — чтение групп/событий;
  mutation/simulate/reset только owner/admin.
- Activity Control и Duplicate Search — только owner/admin.

Gateway может делать coarse-grained проверку, но доменные сервисы обязаны
повторять authorization.

## 5. Деактивация, восстановление и удаление

Использовать текущие API:

- deactivate: `PATCH {"status":"deactivated"}`;
- restore: `PATCH {"status":"active"}`;
- delete: `DELETE`, только `source=local`.

| Target        | Деактивация | Восстановление | Удаление |
| ------------- | ----------: | -------------: | -------: |
| local         |          да |             да |       да |
| amo           |          да |             да |      нет |
| owner         |         нет |              — |      нет |
| текущий actor |         нет |              — |      нет |

При деактивации:

- сделать повторный запрос идемпотентным;
- отозвать refresh-сессии;
- запретить новый login по status;
- сохранить credentials и grants для возможного восстановления;
- добавить пользователя в `disabled_member_ids` distribution-групп;
- опубликовать `teamos.org.user.deactivated.v1`;
- записать audit.

При восстановлении:

- сохранить прежний `sectionAccess`;
- не включать автоматически обратно в distribution;
- опубликовать `user.updated` с `changedFields=["status"]`.

При удалении local:

- проверить owner/self/source;
- отозвать сессии;
- убрать пользователя из `member_ids` и `disabled_member_ids`;
- если он единственный участник группы — вернуть `409` с понятной ошибкой;
- сохранить исторические `distribution_events.user_id`;
- опубликовать deactivated event, затем новый `teamos.org.user.deleted.v1`;
- после этого физически удалить company-user.

## 6. Reconciliation с amoCRM

`syncAmoUsersNow` должен обрабатывать полный успешный snapshot, а не только
создание:

1. `FetchAll` обязан завершить всю пагинацию.
2. При любой upstream-ошибке никого не помечать удалённым.
3. В serializable transaction:
   - создать отсутствующих;
   - не перезаписывать вручную изменённые профиль, роль, status и grants;
   - очистить tombstone у повторно появившегося external ID;
   - для отсутствующих в полном snapshot amo-users установить
     `external_deleted_at=now()`.
4. Для исчезнувшего пользователя:
   - отозвать сессии;
   - удалить password/access link;
   - отключить в distribution;
   - опубликовать deactivated event;
   - записать system audit.
5. List/Get/login/refresh/access-link должны исключать tombstoned users.
6. При повторном появлении снять tombstone, но не восстанавливать credentials и
   не менять вручную установленный TeamOS status.

Обновить описание `UserSource` в OpenAPI: профиль управляется в TeamOS, а факт
наличия amo-сотрудника сверяется с amoCRM.

## 7. Аудит

Добавить append-only `user_admin_audit`:

- `company_id`;
- nullable `target_user_id`;
- nullable `actor_user_id`;
- `actor_kind`: `user | amo_sync | system`;
- `action`: `sections_changed | deactivated | reactivated | deleted |
external_removed | external_restored`;
- `before_state jsonb`;
- `after_state jsonb`;
- `request_id`;
- `created_at`.

Никогда не писать пароль, token access-link, JWT или credential hash.

Исправить существующий `employee_access_audit`:

- `actor_user_id` FK сейчас может блокировать удаление local admin;
- `target_user_id ON DELETE CASCADE` удаляет историю.

Перевести user FK в `ON DELETE SET NULL` либо хранить immutable UUID snapshot
без FK.

## 8. События

Аддитивно обновить `contracts/events/org.proto`:

- section access в user snapshot либо отдельный
  `OrgUserSectionAccessChanged`;
- новый `OrgUserDeletedEvent`;
- существующий `OrgUserDeactivatedEvent` сохранить.

## 9. Acceptance criteria и тесты

- Owner/admin меняют sections employee; employee/partner получают `403`.
- Sections для owner/admin/partner отклоняются.
- Unknown, duplicate values и пустой список отклоняются.
- Default/backfill работает для local, amo и invite.
- Role transitions корректно создают/удаляют grants.
- JWT/refresh возвращает актуальный `sec`.
- Прямые вызовы KB/Academy/Schedule/Distribution без grant дают `403`.
- Distribution для employee read-only.
- Оба источника деактивируются и восстанавливаются; сессии отзываются.
- Local удаляется, amo получает `409`.
- Удаление не ломается audit FK и корректно чистит distribution membership.
- Только успешный полный amo snapshot ставит tombstone отсутствующим.
- Ошибка upstream или неполная пагинация никого не скрывает.
- Повторное появление amo снимает tombstone без восстановления credentials.
- Cross-company IDs не дают утечки.
- Гонки sections/deactivate/amo sync сериализуются через `FOR UPDATE`.

Финальная проверка:

```bash
make gen
make test
make test-race
make lint
make check-contract
```

Отдельное решение: self-contained access JWT может жить до 15 минут после
деактивации или урезания sections. Если нужно мгновенное прекращение любого
bearer-доступа, добавить security-version/revocation check в gateway.
