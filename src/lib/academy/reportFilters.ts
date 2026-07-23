export interface InternalReportFilters {
  q?: string;
  courseId?: string;
  departmentId?: string;
  positionId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export function parseReportFilters(params: URLSearchParams): InternalReportFilters {
  return {
    q: params.get('q') ?? undefined,
    courseId: params.get('courseId') ?? undefined,
    departmentId: params.get('departmentId') ?? undefined,
    positionId: params.get('positionId') ?? undefined,
    status: params.get('status') ?? undefined,
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: parsePositiveInt(params.get('pageSize'), 20),
    sort: params.get('sort') ?? undefined,
  };
}

export function reportFiltersToSearchParams(filters: InternalReportFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.courseId) params.set('courseId', filters.courseId);
  if (filters.departmentId) params.set('departmentId', filters.departmentId);
  if (filters.positionId) params.set('positionId', filters.positionId);
  if (filters.status) params.set('status', filters.status);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize && filters.pageSize !== 20) params.set('pageSize', String(filters.pageSize));
  if (filters.sort) params.set('sort', filters.sort);
  return params;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
