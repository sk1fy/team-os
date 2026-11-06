import { useEffect, useRef, useState } from 'react';
import {
  taskControlApi as api,
  type TaskControlConnection,
  type TaskControlDraft,
  type TaskControlRule,
} from '@/api/taskControl';

/**
 * Черновик правил подключения: загрузка, локальные правки и сохранение с применением.
 * Семантика перенесена из прежнего ConnectionEditor без изменений: ревизии и
 * scope fence из загруженного черновика, один applyRequestId на одно тело запроса
 * (повтор после потерянного ответа не создаёт вторую запись), ошибки не теряют правки.
 */
export function useRulesDraft(connection: TaskControlConnection | undefined) {
  const id = connection?.scope.bindingId;
  const [draft, setDraft] = useState<TaskControlDraft>();
  const [rules, setRules] = useState<TaskControlRule[]>([]);
  const pendingSave = useRef<{ payload: string; requestId: string } | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = !!draft && JSON.stringify(rules) !== JSON.stringify(draft.rules);
  const active =
    !!connection && connection.installation.state === 'installed' && connection.state === 'active';

  useEffect(() => {
    if (!id) return;
    let current = true;
    api
      .getTaskControlDraft(id)
      .then((saved) => {
        if (current) {
          setDraft(saved);
          setRules(saved.rules);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      if (!draft || !id) return;
      const input = {
        expectedBindingRevision: draft.scope.bindingRevision,
        expectedModeEpoch: draft.scope.modeEpoch,
        expectedRevision: draft.revision,
        rules,
      };
      const payload = JSON.stringify(input);
      if (pendingSave.current?.payload !== payload) {
        pendingSave.current = { payload, requestId: crypto.randomUUID() };
      }
      const saved = await api.saveTaskControlRules(id, {
        ...input,
        applyRequestId: pendingSave.current.requestId,
      });
      pendingSave.current = undefined;
      setDraft(saved);
      setRules(saved.rules);
      setNotice('Правила сохранены. Виджет получит их при следующем обновлении.');
    });

  /** Вернуть правила к сохранённому набору. */
  const discard = () => {
    if (!draft) return;
    setRules(draft.rules);
    setError('');
    setNotice('');
  };

  return {
    draft,
    rules,
    setRules,
    busy,
    error,
    notice,
    dirty,
    active,
    /** Правила можно менять: виджет установлен, подключение активно, черновик загружен. */
    editable: active && !busy && !!draft,
    /** Как прежде: сохранить можно всегда, кроме случая «только что сохранено и правок нет». */
    canSave: active && !busy && !!draft && (dirty || !notice),
    save,
    discard,
  };
}

export type RulesDraft = ReturnType<typeof useRulesDraft>;
