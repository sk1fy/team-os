import type { ID } from '@/types';

type ExternalCourseMeta = {
  courseTitle: string;
};

const storagePrefix = 'teamos:external-academy:course-meta:';

function storageKey(enrollmentId: ID): string {
  return `${storagePrefix}${enrollmentId}`;
}

export function saveExternalCourseMeta(enrollmentId: ID, meta: ExternalCourseMeta): void {
  if (typeof window === 'undefined' || !meta.courseTitle.trim()) return;
  try {
    window.sessionStorage.setItem(
      storageKey(enrollmentId),
      JSON.stringify({ courseTitle: meta.courseTitle.trim() }),
    );
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
}

export function getExternalCourseMeta(enrollmentId: ID): ExternalCourseMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(enrollmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExternalCourseMeta>;
    return typeof parsed.courseTitle === 'string' && parsed.courseTitle.trim()
      ? { courseTitle: parsed.courseTitle.trim() }
      : null;
  } catch {
    return null;
  }
}
