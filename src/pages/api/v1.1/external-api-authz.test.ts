import { describe, it, expect, beforeEach, vi } from 'vitest';

// Route × key-scope matrix for the external API authorization seam.
// Exercises the REAL requireFeature gate (via the ambient ALS principal) so a
// missing-feature key produces a genuine ForbiddenError — the two patterns under
// test are withApiPrincipal (funnels/pages) and authenticateExternalApi+service
// (templates). The data side is faked; only authorization behavior is asserted.

const state = vi.hoisted(() => ({
  authScope: [] as string[],
  writeAccess: true as boolean,
  issued: undefined as { scope: { toArray(): unknown[] } } | undefined,
  templatesImpl: (async () => []) as () => Promise<unknown[]>,
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
          writeAccess: state.writeAccess,
          permissions: PermissionSet.of(state.authScope.map(toFeatureKey)),
        };
      },
    },
    apiKeys: {
      issue: async (input: { scope: { toArray(): unknown[] } }) => {
        state.issued = input;
        return { id: 'k1', prefix: 'sk_test01', plaintext: 'sk_test01_secret' };
      },
      list: async () => [],
    },
  }),
}));
vi.mock('@/composition/authoring-runtime', () => ({
  authoringDepsFromLocals: () => ({
    db: {
      funnel: { findMany: async () => [], findUnique: async () => null },
      page: { findMany: async () => [] },
    },
  }),
}));
vi.mock('@/composition/make-authoring', () => ({
  makeAuthoring: () => ({
    pageDashboard: {
      list: async () => ({ items: [], bindings: [], page: 1, perPage: 20, total: 0, totalPages: 1 }),
      get: async () => ({}),
      create: async () => ({}),
      update: async () => ({}),
    },
    funnelComposing: {
      addStep: async () => {},
      replaceStep: async () => {},
      removeStep: async () => {},
      setStepSlug: async () => {},
    },
  }),
}));
vi.mock('@/composition/make-funnel-dashboard', () => ({
  makeFunnelDashboard: () => ({
    funnels: {
      list: async () => [],
      get: async () => ({ id: 'f1', name: '', description: null, createdAt: new Date(), updatedAt: new Date() }),
      create: async () => ({ id: 'f1', name: '', description: null, createdAt: new Date(), updatedAt: new Date() }),
      update: async () => ({ id: 'f1', name: '', description: null, createdAt: new Date(), updatedAt: new Date() }),
      remove: async () => {},
    },
  }),
}));
vi.mock('@/composition/create-funnel-with-defaults', () => ({
  createFunnelWithDefaults: async () => ({
    id: 'f1',
    name: '',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}));
vi.mock('@/composition/make-commerce-gateway', () => ({
  makeCommerceGatewayReadSide: async () => ({ searchCatalog: async () => [] }),
  CommerceNotConfiguredError: class CommerceNotConfiguredError extends Error {},
}));
vi.mock('@/composition/make-ai-media-deps', () => ({
  makeAiMediaUpload: async () => ({ store: async () => ({ assetId: 'a1', url: 'http://cdn.test/a1' }) }),
}));
vi.mock('@/composition/make-messaging', () => ({
  makeMessaging: () => ({ manageTemplate: { listTemplates: () => state.templatesImpl() } }),
}));
vi.mock('@/composition/analytics/make-diagnostics', () => ({
  loadCheckoutMicroFunnel: async () => ({ stages: [], paymentErrors: [], providers: [] }),
  loadExperimentArms: async () => [],
  loadSegments: async () => [],
  loadTrend: async () => ({ granularity: 'day', points: [], comparison: null }),
}));
vi.mock('@/composition/analytics/make-stats', () => ({ loadStatsData: async () => ({}) }));
vi.mock('@/composition/make-order-fulfillment', () => ({ makeOrderFulfillment: () => ({}) }));
vi.mock('@/composition/order-fulfillment-deps', () => ({ buildOrderFulfillmentDeps: () => ({}) }));
vi.mock('@/modules/order-fulfillment/infra/http/order-routes', () => ({
  handleExternalDeliver: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
}));

import { GET as FunnelsGet, POST as FunnelsPost } from './funnels/index';
import { GET as PagesGet, POST as PagesPost } from './pages/index';
import { PUT as PagePut } from './pages/[pageId]';
import { PUT as FunnelPut, DELETE as FunnelDelete } from './funnels/[funnelId]';
import {
  POST as FunnelPagesPost,
  PUT as FunnelPagesPut,
  PATCH as FunnelPagesPatch,
  DELETE as FunnelPagesDelete,
} from './funnels/[funnelId]/pages';
import { GET as OrdersGet } from './orders/index';
import { GET as PageTemplatesGet } from './page-templates/index';
import { GET as PageTemplateGet } from './page-templates/[key]';
import { POST as MediaUploadUrlPost } from './media/upload-url';
import { POST as MediaUploadPost } from './media/upload';
import { GET as ProductsGet } from './products/index';
import { GET as TemplatesGet } from './templates/index';
import { GET as AnalyticsPaymentsGet } from './analytics/payments';
import { GET as AnalyticsIndexGet } from './analytics/index';
import { GET as AnalyticsTrendGet } from './analytics/trend';
import { GET as AnalyticsSegmentsGet } from './analytics/segments';
import { GET as AnalyticsExperimentsGet } from './analytics/experiments';
import { POST as OrdersDeliverPost } from './orders/[orderId]/deliver';
import { POST as ApiKeysPost } from '../api-keys/index';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { ForbiddenError } from '@/modules/identity/published/principal';

function getCtx() {
  return {
    request: new Request('http://test/api/v1.1/x', { headers: { authorization: 'Bearer sk_test' } }),
    locals: {},
    params: {},
    url: new URL('http://test/api/v1.1/x'),
  } as never;
}

function postCtx(body: unknown) {
  return {
    request: new Request('http://test/api/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: {},
    locals: {},
  } as never;
}

// New v1.1 write routes: covers every path-param shape they're mounted under
// (pageId, funnelId) so the authorization check fires before path/body parsing.
function writeCtx() {
  return {
    request: new Request('http://test/api/v1.1/x', {
      method: 'POST',
      headers: { authorization: 'Bearer sk_test', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
    locals: {},
    params: { pageId: 'p1', funnelId: 'f1', key: 'k1' },
    url: new URL('http://test/api/v1.1/x'),
  } as never;
}

function readCtx() {
  return {
    request: new Request('http://test/api/v1.1/x', { headers: { authorization: 'Bearer sk_test' } }),
    locals: {},
    params: { pageId: 'p1', funnelId: 'f1', key: 'k1' },
    url: new URL('http://test/api/v1.1/x'),
  } as never;
}

// media/upload reads a multipart body (context.request.formData()) rather than JSON; the
// authorization gate must fire before that parsing, so the body content here is minimal.
function mediaUploadCtx() {
  const form = new FormData();
  return {
    request: new Request('http://test/api/v1.1/media/upload', {
      method: 'POST',
      headers: { authorization: 'Bearer sk_test' },
      body: form,
    }),
    locals: {},
    params: {},
    url: new URL('http://test/api/v1.1/media/upload'),
  } as never;
}

beforeEach(() => {
  state.authScope = [];
  state.writeAccess = true;
  state.issued = undefined;
  state.templatesImpl = async () => [];
});

describe('external API — missing feature → 403 (not 500)', () => {
  it('GET /funnels with empty-scope key → 403', async () => {
    state.authScope = [];
    const res = (await FunnelsGet(getCtx())) as Response;
    expect(res.status).toBe(403);
  });

  it('GET /funnels with FUNNELS-scope key → 200', async () => {
    state.authScope = ['FUNNELS'];
    const res = (await FunnelsGet(getCtx())) as Response;
    expect(res.status).toBe(200);
  });

  it('GET /pages with empty-scope key → 403', async () => {
    state.authScope = [];
    const res = (await PagesGet(getCtx())) as Response;
    expect(res.status).toBe(403);
  });

  it('GET /pages with PAGES-scope key → 200', async () => {
    state.authScope = ['PAGES'];
    const res = (await PagesGet(getCtx())) as Response;
    expect(res.status).toBe(200);
  });

  it('GET /templates with empty-scope key → 403', async () => {
    state.authScope = [];
    state.templatesImpl = async () => [{ key: 'order.receipt' }];
    const res = await TemplatesGet(getCtx());
    expect(res.status).toBe(403);
  });

  it('GET /templates ForbiddenError → 403, not masked as 500', async () => {
    state.authScope = ['SETTINGS_EMAIL'];
    state.templatesImpl = async () => {
      throw new ForbiddenError(toFeatureKey('SETTINGS_EMAIL'));
    };
    const res = await TemplatesGet(getCtx());
    expect(res.status).toBe(403);
  });

  it('GET /templates genuine failure still → 500', async () => {
    state.authScope = ['SETTINGS_EMAIL'];
    state.templatesImpl = async () => {
      throw new Error('db down');
    };
    const res = await TemplatesGet(getCtx());
    expect(res.status).toBe(500);
  });

  it('GET /templates with access → 200', async () => {
    state.authScope = ['SETTINGS_EMAIL'];
    state.templatesImpl = async () => [{ key: 'order.receipt' }];
    const res = await TemplatesGet(getCtx());
    expect(res.status).toBe(200);
  });
});

describe('external analytics + fulfillment routes enforce their grant', () => {
  const analyticsRoutes: [string, (ctx: never) => Promise<Response>][] = [
    ['analytics/index', AnalyticsIndexGet as never],
    ['analytics/payments', AnalyticsPaymentsGet as never],
    ['analytics/trend', AnalyticsTrendGet as never],
    ['analytics/segments', AnalyticsSegmentsGet as never],
    ['analytics/experiments', AnalyticsExperimentsGet as never],
  ];

  // The diagnostics routes require funnelId, so the happy path must supply it or they 400
  // before the assertion can distinguish authorized from unauthorized.
  function analyticsCtx() {
    return {
      request: new Request('http://test/api/v1.1/analytics?funnelId=f1', {
        headers: { authorization: 'Bearer sk_test' },
      }),
      locals: {},
      params: {},
      url: new URL('http://test/api/v1.1/analytics?funnelId=f1'),
    } as never;
  }

  for (const [name, route] of analyticsRoutes) {
    it(`GET ${name} with empty-scope key → 403`, async () => {
      state.authScope = [];
      const res = await route(analyticsCtx());
      expect(res.status).toBe(403);
    });

    it(`GET ${name} with ANALYTICS-scope key → 200`, async () => {
      state.authScope = ['ANALYTICS'];
      const res = await route(analyticsCtx());
      expect(res.status).toBe(200);
    });
  }

  function deliverCtx() {
    return {
      request: new Request('http://test/api/v1.1/orders/o1/deliver', {
        method: 'POST',
        headers: { authorization: 'Bearer sk_test' },
      }),
      locals: {},
      params: { orderId: 'o1' },
    } as never;
  }

  it('POST orders/:id/deliver with write-enabled but unrelated scope → 403', async () => {
    state.authScope = ['PAGES'];
    const res = (await OrdersDeliverPost(deliverCtx())) as Response;
    expect(res.status).toBe(403);
  });

  it('POST orders/:id/deliver with ORDERS scope → 200', async () => {
    state.authScope = ['ORDERS'];
    const res = (await OrdersDeliverPost(deliverCtx())) as Response;
    expect(res.status).toBe(200);
  });
});

describe('POST /api/api-keys — scope is bounded by the creator', () => {
  const creator = (features: string[]) => ({
    kind: 'user' as const,
    userId: 'admin',
    tenantId: 'default',
    permissions: PermissionSet.of(features.map(toFeatureKey)),
  });
  const issue = (features: string[], body: unknown) =>
    runWithContext({ tenantId: 'default', principal: creator(features) }, async () => ApiKeysPost(postCtx(body)));

  it('no grants → the creator own scope, never the full catalog', async () => {
    const res = (await issue(['API_KEYS', 'ORDERS'], { name: 'CI bot' })) as Response;
    expect(res.status).toBe(201);
    const granted = (state.issued!.scope.toArray() as string[]).slice().sort();
    expect(granted).toEqual([toFeatureKey('API_KEYS'), toFeatureKey('ORDERS')].sort());
    expect(granted).not.toContain(toFeatureKey('PERMISSIONS'));
  });

  it('explicit grants within the creator scope → honored verbatim', async () => {
    await issue(['API_KEYS', 'ORDERS'], { name: 'scoped', grants: ['ORDERS'] });
    expect(state.issued!.scope.toArray()).toEqual([toFeatureKey('ORDERS')]);
  });

  it('explicit grants beyond the creator scope → 403, nothing issued', async () => {
    const res = (await issue(['API_KEYS'], { name: 'greedy', grants: ['ORDERS'] })) as Response;
    expect(res.status).toBe(403);
    expect(state.issued).toBeUndefined();
  });

  it('explicit empty grants → empty scope (intentional scope-down still possible)', async () => {
    await issue(['API_KEYS'], { name: 'locked', grants: [] });
    expect(state.issued!.scope.toArray()).toEqual([]);
  });
});

describe('v1.1 write routes require both the feature and writeAccess', () => {
  const cases: [string, (ctx: never) => unknown, string][] = [
    ['POST /pages', PagesPost, 'PAGES'],
    ['PUT /pages/:id', PagePut, 'PAGES'],
    ['POST /funnels', FunnelsPost, 'FUNNELS'],
    ['PUT /funnels/:id', FunnelPut, 'FUNNELS'],
    ['DELETE /funnels/:id', FunnelDelete, 'FUNNELS'],
    ['POST /funnels/:id/pages', FunnelPagesPost, 'FUNNELS'],
    ['PUT /funnels/:id/pages', FunnelPagesPut, 'FUNNELS'],
    ['PATCH /funnels/:id/pages', FunnelPagesPatch, 'FUNNELS'],
    ['DELETE /funnels/:id/pages', FunnelPagesDelete, 'FUNNELS'],
    ['POST /media/upload-url', MediaUploadUrlPost, 'PAGES'],
  ];

  it.each(cases)('%s returns 403 without the feature', async (_label, route) => {
    state.authScope = [];
    state.writeAccess = true;
    const res = (await route(writeCtx())) as Response;
    expect(res.status).toBe(403);
  });

  it.each(cases)('%s returns 403 without writeAccess', async (_label, route, feature) => {
    state.authScope = [feature];
    state.writeAccess = false;
    const res = (await route(writeCtx())) as Response;
    expect(res.status).toBe(403);
  });
});

describe('POST /media/upload requires both the feature and writeAccess', () => {
  it('returns 403 without the PAGES feature', async () => {
    state.authScope = [];
    state.writeAccess = true;
    const res = (await MediaUploadPost(mediaUploadCtx())) as Response;
    expect(res.status).toBe(403);
  });

  it('returns 403 without writeAccess, in the same envelope every other write route uses', async () => {
    state.authScope = ['PAGES'];
    state.writeAccess = false;
    const res = (await MediaUploadPost(mediaUploadCtx())) as Response;
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        message: 'Write access is not enabled for this API key. Enable it in API Settings.',
        type: 'permission_error',
        code: 'write_access_denied',
      },
    });
  });
});

describe('v1.1 new read routes require their feature', () => {
  it.each([
    ['GET /orders', OrdersGet, 'ORDERS'],
    ['GET /page-templates', PageTemplatesGet, 'PAGES'],
    ['GET /page-templates/:key', PageTemplateGet, 'PAGES'],
    ['GET /products', ProductsGet, 'PAGES'],
  ] as [string, (ctx: never) => unknown, string][])('%s returns 403 without %s', async (_label, route) => {
    state.authScope = [];
    const res = (await route(readCtx())) as Response;
    expect(res.status).toBe(403);
  });
});
