import { academyCoursesApi, type CoursePartnerAudienceKind } from '@/api/academy';
import { queryKeys } from '@/api/queryKeys';
import type { AcademyCourseDetail } from '@/types/academy';

export type CourseSettingsSaveScope = 'course' | 'draft' | 'partnerAudience';

export type CourseSettingsSaveInput = {
  courseId: string;
  visibility: AcademyCourseDetail['visibility'];
  draft: {
    title: string;
    description?: string;
    sequential: boolean;
    defaultInternalDeadlineDays?: number;
  };
  partnerAudience?: {
    audience: CoursePartnerAudienceKind;
    partnerUserIds: string[];
  };
};

export type CourseSettingsSaveResult = {
  succeeded: CourseSettingsSaveScope[];
  failed: Array<{ scope: CourseSettingsSaveScope; error: unknown }>;
};

export type CourseSettingsSaveApi = Pick<
  typeof academyCoursesApi,
  'update' | 'updateDraft' | 'setPartnerAudience'
>;

const scopeLabels: Record<CourseSettingsSaveScope, string> = {
  course: 'видимость курса',
  draft: 'настройки черновика',
  partnerAudience: 'доступ партнёров',
};

export async function saveCourseSettings(
  input: CourseSettingsSaveInput,
  api: CourseSettingsSaveApi = academyCoursesApi,
): Promise<CourseSettingsSaveResult> {
  const operations: Array<{
    scope: CourseSettingsSaveScope;
    run: () => Promise<unknown>;
  }> = [
    {
      scope: 'course',
      run: () => api.update(input.courseId, { visibility: input.visibility }),
    },
    {
      scope: 'draft',
      run: () => api.updateDraft(input.courseId, input.draft),
    },
  ];

  const partnerAudience = input.partnerAudience;
  if (partnerAudience) {
    operations.push({
      scope: 'partnerAudience',
      run: () => api.setPartnerAudience(input.courseId, partnerAudience),
    });
  }

  const settled = await Promise.allSettled(
    operations.map((operation) => Promise.resolve().then(operation.run)),
  );
  const succeeded: CourseSettingsSaveScope[] = [];
  const failed: CourseSettingsSaveResult['failed'] = [];

  settled.forEach((result, index) => {
    const scope = operations[index]!.scope;
    if (result.status === 'fulfilled') {
      succeeded.push(scope);
    } else {
      failed.push({ scope, error: result.reason });
    }
  });

  return { succeeded, failed };
}

export function courseSettingsErrorMessage(result: CourseSettingsSaveResult): string {
  const failedLabels = result.failed.map(({ scope }) => scopeLabels[scope]).join(', ');
  if (result.succeeded.length > 0) {
    return `Не удалось сохранить: ${failedLabels}. Остальные изменения сохранены.`;
  }
  return `Не удалось сохранить настройки: ${failedLabels}.`;
}

export function courseSettingsInvalidationKeys(courseId: string) {
  return [
    queryKeys.academyV2.course(courseId),
    queryKeys.academyV2.draft(courseId),
    queryKeys.academyV2.coursesRoot,
    queryKeys.academyV2.catalogRoot,
    queryKeys.academyV2.partnerAudience(courseId),
  ] as const;
}
