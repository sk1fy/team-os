import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/** Warn on tab close / in-app navigation when the draft editor is dirty. */
export function useUnsavedChanges(dirty: boolean, message = 'Есть несохранённые изменения. Уйти?') {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, message]);

  const blocker = useBlocker(dirty);
  return {
    blocked: blocker.state === 'blocked',
    proceed: () => {
      if (blocker.state === 'blocked') blocker.proceed();
    },
    stay: () => {
      if (blocker.state === 'blocked') blocker.reset();
    },
  };
}
