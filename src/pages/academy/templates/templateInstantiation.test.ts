import { describe, expect, it, vi } from 'vitest';
import type { CourseVersionAuthorDetail } from '@/types/academy';
import { waitForInstantiatedDraft } from './templateInstantiation';

function draft(lessonCount: number): CourseVersionAuthorDetail {
  return {
    id: 'draft-1',
    courseId: 'course-1',
    versionNumber: 1,
    status: 'draft',
    title: 'Курс',
    sequential: true,
    createdAt: '2026-08-13T10:00:00Z',
    updatedAt: '2026-08-13T10:00:00Z',
    sections:
      lessonCount > 0
        ? [
            {
              id: 'section-1',
              courseId: 'course-1',
              versionId: 'draft-1',
              title: 'Раздел',
              order: 0,
              lessons: Array.from({ length: lessonCount }, (_, order) => ({
                id: `lesson-${order}`,
                courseId: 'course-1',
                versionId: 'draft-1',
                sectionId: 'section-1',
                title: `Урок ${order + 1}`,
                order,
                content: { type: 'doc', content: [] },
              })),
            },
          ]
        : [],
  };
}

describe('template instantiation readiness', () => {
  it('keeps waiting while the draft is transiently empty', async () => {
    const loadDraft = vi
      .fn()
      .mockRejectedValueOnce(new Error('not replicated yet'))
      .mockResolvedValueOnce(draft(0))
      .mockResolvedValueOnce(draft(3));

    const result = await waitForInstantiatedDraft({
      initialDraft: draft(0),
      expectedLessonCount: 3,
      loadDraft,
      wait: async () => undefined,
    });

    expect(result.sections[0]?.lessons).toHaveLength(3);
    expect(loadDraft).toHaveBeenCalledTimes(3);
  });

  it('does not make an extra request when the response is already complete', async () => {
    const loadDraft = vi.fn();
    await expect(
      waitForInstantiatedDraft({
        initialDraft: draft(3),
        expectedLessonCount: 3,
        loadDraft,
      }),
    ).resolves.toEqual(draft(3));
    expect(loadDraft).not.toHaveBeenCalled();
  });

  it('fails closed instead of opening an editable zero-state', async () => {
    await expect(
      waitForInstantiatedDraft({
        initialDraft: draft(0),
        expectedLessonCount: 3,
        loadDraft: async () => draft(0),
        refreshAttempts: 2,
        wait: async () => undefined,
      }),
    ).rejects.toThrow('структура шаблона ещё не готова');
  });
});
