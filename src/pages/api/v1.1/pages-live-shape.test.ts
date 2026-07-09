import { describe, it, expect, vi } from 'vitest';

// Asserts the v1.1 page endpoints read the LIVE Page table (status PUBLISHED /
// publishedData) and emit the simplified shape — no version/contentHash/revisionId.

const state = vi.hoisted(() => ({
  pageRows: [] as unknown[],
  pageById: undefined as unknown,
}));

vi.mock('@/composition/identity-deps', () => ({ resolveIdentityDeps: () => ({}) }));
vi.mock('@/composition/make-identity', () => ({
  makeIdentity: () => ({
    apiAuth: {
      authenticate: async () => {
        const { PermissionSet } = await import('@/modules/identity/domain/permission-set');
        const { toFeatureKey } = await import('@/modules/identity/domain/feature-key');
        return {
          kind: 'apiClient',
          apiKeyId: 'k1',
          tenantId: 'default',
          writeAccess: true,
          permissions: PermissionSet.of([toFeatureKey('PAGES')]),
        };
      },
    },
  }),
}));
vi.mock('@/composition/authoring-runtime', () => ({
  authoringDepsFromLocals: () => ({
    db: {
      page: {
        findMany: async () => state.pageRows,
        findUnique: async () => state.pageById,
      },
    },
  }),
}));

import { GET as PagesGet } from './pages/index';
import { GET as PageGet } from './pages/[pageId]';

function ctx(params: Record<string, string> = {}) {
  return {
    request: new Request('http://test/api/v1.1/x', { headers: { authorization: 'Bearer sk_test' } }),
    locals: {},
    params,
    url: new URL('http://test/api/v1.1/x'),
  } as never;
}

describe('GET /api/v1.1/pages — live published list', () => {
  it('maps Page rows to the simplified list shape', async () => {
    state.pageRows = [
      { id: 'p1', slug: 'checkout', name: 'Checkout', type: 'checkout', updatedAt: new Date('2026-01-01') },
    ];
    const res = (await PagesGet(ctx())) as Response;
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pages: Record<string, unknown>[] };
    expect(body.pages).toEqual([
      { pageId: 'p1', slug: 'checkout', name: 'Checkout', type: 'checkout', updatedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(body.pages[0]).not.toHaveProperty('version');
    expect(body.pages[0]).not.toHaveProperty('contentHash');
  });
});

describe('GET /api/v1.1/pages/:pageId — live published detail', () => {
  it('returns document=publishedData and drops versioning fields', async () => {
    state.pageById = {
      id: 'p1',
      slug: 'checkout',
      name: 'Checkout',
      type: 'checkout',
      editorType: 'PUCK',
      publishedData: { content: [], root: {} },
      htmlContent: null,
      meta: { title: 'X' },
      status: 'PUBLISHED',
      updatedAt: new Date('2026-01-01'),
    };
    const res = (await PageGet(ctx({ pageId: 'p1' }))) as Response;
    expect(res.status).toBe(200);
    const body = (await res.json()) as { page: Record<string, unknown> };
    expect(body.page).toEqual({
      pageId: 'p1',
      slug: 'checkout',
      name: 'Checkout',
      type: 'checkout',
      editorType: 'PUCK',
      document: { content: [], root: {} },
      html: null,
      meta: { title: 'X' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(body.page).not.toHaveProperty('version');
    expect(body.page).not.toHaveProperty('contentHash');
  });

  it('404 when the page is not PUBLISHED', async () => {
    state.pageById = { id: 'p1', status: 'DRAFT' };
    const res = (await PageGet(ctx({ pageId: 'p1' }))) as Response;
    expect(res.status).toBe(404);
  });

  it('404 when the page does not exist', async () => {
    state.pageById = null;
    const res = (await PageGet(ctx({ pageId: 'missing' }))) as Response;
    expect(res.status).toBe(404);
  });
});
