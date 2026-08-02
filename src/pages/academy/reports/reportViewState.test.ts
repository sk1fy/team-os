import { describe, expect, it } from 'vitest';
import { resolveReportViewState } from './reportViewState';

describe('resolveReportViewState', () => {
  it('does not report an empty result while a UUID filter is invalid', () => {
    expect(
      resolveReportViewState({
        hasInvalidFilter: true,
        isError: false,
        isLoading: false,
        itemCount: 0,
      }),
    ).toBe('blocked');
  });

  it('reports an empty result after valid filters produce no rows', () => {
    expect(
      resolveReportViewState({
        hasInvalidFilter: false,
        isError: false,
        isLoading: false,
        itemCount: 0,
      }),
    ).toBe('empty');
  });
});
