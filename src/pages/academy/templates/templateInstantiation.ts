import type { CourseVersionAuthorDetail } from '@/types/academy';

export function instantiatedDraftLessonCount(draft: CourseVersionAuthorDetail): number {
  return draft.sections.reduce((total, section) => total + section.lessons.length, 0);
}

type WaitForInstantiatedDraftOptions = {
  initialDraft: CourseVersionAuthorDetail;
  expectedLessonCount?: number;
  loadDraft: () => Promise<CourseVersionAuthorDetail>;
  refreshAttempts?: number;
  wait?: () => Promise<void>;
};

/**
 * Some backends return the new course before template lessons are visible via
 * the draft read endpoint. Keep the creation action pending until the expected
 * template structure is available, so the builder cannot expose an editable
 * zero-state in between.
 */
export async function waitForInstantiatedDraft({
  initialDraft,
  expectedLessonCount,
  loadDraft,
  refreshAttempts = 10,
  wait = () => new Promise((resolve) => window.setTimeout(resolve, 300)),
}: WaitForInstantiatedDraftOptions): Promise<CourseVersionAuthorDetail> {
  if (!expectedLessonCount || instantiatedDraftLessonCount(initialDraft) >= expectedLessonCount) {
    return initialDraft;
  }

  let draft = initialDraft;
  for (let attempt = 0; attempt < refreshAttempts; attempt += 1) {
    await wait();
    try {
      draft = await loadDraft();
    } catch {
      // A just-created draft can briefly be absent from a read replica. Keep
      // the mutation pending and retry within the same bounded guard.
      continue;
    }
    if (instantiatedDraftLessonCount(draft) >= expectedLessonCount) return draft;
  }

  throw new Error(
    'Курс создан, но структура шаблона ещё не готова. Откройте курс из списка через несколько секунд.',
  );
}
