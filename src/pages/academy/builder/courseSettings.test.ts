import { describe, expect, it, vi } from 'vitest';
import {
  courseSettingsErrorMessage,
  courseSettingsInvalidationKeys,
  saveCourseSettings,
  type CourseSettingsSaveApi,
} from './courseSettings';

const input = {
  courseId: 'course-1',
  visibility: 'company' as const,
  draft: {
    title: 'Новая версия курса',
    description: 'Описание',
    sequential: false,
    defaultInternalDeadlineDays: 14,
  },
  partnerAudience: {
    audience: 'selected_partners' as const,
    partnerUserIds: ['partner-1'],
  },
};

describe('course settings persistence', () => {
  it('sends course, draft and partner settings through separate API methods', async () => {
    const api = {
      update: vi.fn().mockResolvedValue({ id: 'course-1' }),
      updateDraft: vi.fn().mockResolvedValue({ id: 'draft-1' }),
      setPartnerAudience: vi.fn().mockResolvedValue({
        audience: 'selected_partners',
        partnerUserIds: ['partner-1'],
      }),
    } as unknown as CourseSettingsSaveApi;

    await expect(saveCourseSettings(input, api)).resolves.toEqual({
      succeeded: ['course', 'draft', 'partnerAudience'],
      failed: [],
    });
    expect(api.update).toHaveBeenCalledWith('course-1', { visibility: 'company' });
    expect(api.updateDraft).toHaveBeenCalledWith('course-1', input.draft);
    expect(api.setPartnerAudience).toHaveBeenCalledWith('course-1', input.partnerAudience);
  });

  it('reports partial failures without hiding successful changes', async () => {
    const courseError = new Error('course update failed');
    const api = {
      update: vi.fn().mockRejectedValue(courseError),
      updateDraft: vi.fn().mockResolvedValue({ id: 'draft-1' }),
      setPartnerAudience: vi.fn().mockResolvedValue({
        audience: 'selected_partners',
        partnerUserIds: ['partner-1'],
      }),
    } as unknown as CourseSettingsSaveApi;

    const result = await saveCourseSettings(input, api);

    expect(result).toEqual({
      succeeded: ['draft', 'partnerAudience'],
      failed: [{ scope: 'course', error: courseError }],
    });
    expect(courseSettingsErrorMessage(result)).toBe(
      'Не удалось сохранить: видимость курса. Остальные изменения сохранены.',
    );
  });

  it('invalidates course, draft, lists, catalog and partner audience separately', () => {
    expect(courseSettingsInvalidationKeys('course-1')).toEqual([
      ['academy-v2', 'course', 'course-1'],
      ['academy-v2', 'draft', 'course-1'],
      ['academy-v2', 'courses'],
      ['academy-v2', 'catalog'],
      ['academy-v2', 'partner-audience', 'course-1'],
    ]);
  });
});
