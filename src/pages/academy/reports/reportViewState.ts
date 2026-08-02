export type ReportViewState = 'blocked' | 'error' | 'loading' | 'empty' | 'ready';

interface ResolveReportViewStateOptions {
  hasInvalidFilter: boolean;
  isError: boolean;
  isLoading: boolean;
  itemCount: number;
}

export function resolveReportViewState({
  hasInvalidFilter,
  isError,
  isLoading,
  itemCount,
}: ResolveReportViewStateOptions): ReportViewState {
  if (hasInvalidFilter) return 'blocked';
  if (isError) return 'error';
  if (isLoading) return 'loading';
  if (itemCount === 0) return 'empty';
  return 'ready';
}
