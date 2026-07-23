import { useEffect, useState } from 'react';

/** Warn on tab close / in-app navigation when the draft editor is dirty. */
export function useUnsavedChanges(dirty: boolean, message = 'Есть несохранённые изменения. Уйти?') {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, message]);

  return {
    blocked: pendingAction !== null,
    request: (action: () => void) => {
      if (!dirty) {
        action();
        return;
      }
      setPendingAction(() => action);
    },
    proceed: () => {
      const action = pendingAction;
      setPendingAction(null);
      action?.();
    },
    stay: () => setPendingAction(null),
  };
}
