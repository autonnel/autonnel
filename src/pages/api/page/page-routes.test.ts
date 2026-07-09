import { describe, it, expect, vi } from 'vitest';

const del = vi.fn().mockResolvedValue(undefined);
const update = vi.fn().mockResolvedValue({ id: 'p1', slug: 'p1', status: 'PUBLISHED' });

vi.mock('@/composition/make-authoring', () => ({
  makeAuthoring: () => ({
    pageDashboard: { delete: del, update },
  }),
}));
vi.mock('@/composition/authoring-runtime', () => ({
  authoringDepsFromLocals: () => ({}),
}));
vi.mock('@/modules/identity/application/principal-resolution', () => ({
  requireFeature: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock('@/modules/identity/domain/feature-key', () => ({
  toFeatureKey: (k: string) => k,
}));

import { DELETE } from './[pageId]';
import { POST as PUBLISH } from './[pageId]/publish';

describe('POST /api/page/[pageId]/publish', () => {
  it('promotes the draft to live via the dashboard publish path and returns ok', async () => {
    update.mockClear();
    const request = new Request('http://x/api/page/p1/publish', { method: 'POST' });
    const res = await PUBLISH({ request, params: { pageId: 'p1' }, locals: {} } as never);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith('p1', { status: 'PUBLISHED' });
  });
});

describe('DELETE /api/page/[pageId]', () => {
  it('deletes a page and returns 200', async () => {
    const request = new Request('http://x/api/page/p1', { method: 'DELETE' });
    const res = await DELETE({ request, params: { pageId: 'p1' }, locals: {} } as never);
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith('p1');
  });
});
