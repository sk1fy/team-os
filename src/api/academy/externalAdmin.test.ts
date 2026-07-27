import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { academyExternalAdminApi } from './externalAdmin';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ accessToken: null, initialized: false });
});

describe('external registry legacy array compatibility', () => {
  it('filters and slices external learners when the backend returns a full array', async () => {
    const learners = Array.from({ length: 30 }, (_, index) => ({
      id: `learner-${index}`,
      companyId: 'company-1',
      email: index % 2 === 0 ? `match-${index}@example.com` : `other-${index}@example.com`,
      firstSeenAt: '2026-07-27T10:00:00Z',
      enrollmentCount: 1,
      completedCount: 0,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(learners)));

    const result = await academyExternalAdminApi.listLearners({
      q: 'match',
      page: 2,
      pageSize: 5,
    });

    expect(result).toMatchObject({
      page: 2,
      pageSize: 5,
      total: 15,
      totalPages: 3,
    });
    expect(result.items).toHaveLength(5);
    expect(result.items.map((item) => item.email)).toEqual([
      'match-10@example.com',
      'match-12@example.com',
      'match-14@example.com',
      'match-16@example.com',
      'match-18@example.com',
    ]);
  });

  it('filters and slices personal accesses returned as a full array', async () => {
    const accesses = Array.from({ length: 12 }, (_, index) => ({
      id: `access-${index}`,
      courseId: 'course-1',
      courseVersionId: 'version-1',
      expectedEmail: `learner-${index}@example.com`,
      status: index % 2 === 0 ? 'issued' : 'revoked',
      deadlineDays: 3,
      issuedAt: '2026-07-27T10:00:00Z',
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(accesses)));

    const result = await academyExternalAdminApi.listPersonalAccesses('course-1', {
      status: 'issued',
      page: 2,
      pageSize: 2,
    });

    expect(result).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 6,
      totalPages: 3,
    });
    expect(result.items.map((item) => item.id)).toEqual(['access-4', 'access-6']);
  });
});
