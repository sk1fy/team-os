import type { CourseAssignmentSummary } from '@/types/academy';
import type { ID } from '@/types';
import { academyGet, academyMutate, encodeId, type RequestOptions } from './httpHelpers';

export const academyDistributionApi = {
  listAssignments(courseId: ID, options?: RequestOptions): Promise<CourseAssignmentSummary[]> {
    return academyGet(`/academy/courses/${encodeId(courseId)}/assignments`, options);
  },

  assign(
    courseId: ID,
    input: {
      targetType: 'user' | 'position' | 'department';
      targetId: ID;
      dueDate?: string;
      courseVersionId?: ID;
    },
    options?: RequestOptions,
  ): Promise<CourseAssignmentSummary> {
    return academyMutate(
      `/academy/courses/${encodeId(courseId)}/assignments`,
      'POST',
      input,
      options,
    );
  },

  revokeAssignment(assignmentId: ID, options?: RequestOptions): Promise<void> {
    return academyMutate(
      `/academy/assignments/${encodeId(assignmentId)}`,
      'DELETE',
      undefined,
      options,
    );
  },
};
