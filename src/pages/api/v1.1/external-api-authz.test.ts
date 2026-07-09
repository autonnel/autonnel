import { describe, it, expect, beforeEach, vi } from 'vitest';

// Route × key-scope matrix for the external API authorization seam.
// Exercises the REAL requireFeature gate (via the ambient ALS principal) so a
// missing-feature key produces a genuine ForbiddenError — the two patterns under
// test are withApiPrincipal (funnels/pages) and authenticateExternalApi+service
// (templates). The data side is faked; only authorization behavior is asserted.

const state = vi.hoisted(() => ({
  authScope: [] as string[],
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
          writeAccess: true,
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
      funnel: { findMany: async () => [] },
      page: { findMany: async () => [] },
    },
  }),
}));
vi.mock('@/composition/make-messaging', () => ({
  makeMessaging: () => ({ manageTemplate: { listTemplates: () => state.templatesImpl() } }),
}));
vi.mock('@/lib/auth/externalApiAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/externalApiAuth')>()),
  authenticateExternalApi: async () => ({ authenticated: true, writeAccess: true }),
}));

import { GET as FunnelsGet } from './funnels/index';
import { GET as PagesGet } from './pages/index';
import { GET as TemplatesGet } from './templates/index';
import { POST as ApiKeysPost } from '../api-keys/index';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { FEATURES as FEATURE_CATALOG } from '@/modules/identity/infra/feature-catalog';
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

beforeEach(() => {
  state.authScope = [];
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

  it('GET /templates ForbiddenError → 403, not masked as 500', async () => {
    state.templatesImpl = async () => {
      throw new ForbiddenError(toFeatureKey('SETTINGS_EMAIL'));
    };
    const res = await TemplatesGet(getCtx());
    expect(res.status).toBe(403);
  });

  it('GET /templates genuine failure still → 500', async () => {
    state.templatesImpl = async () => {
      throw new Error('db down');
    };
    const res = await TemplatesGet(getCtx());
    expect(res.status).toBe(500);
  });

  it('GET /templates with access → 200', async () => {
    state.templatesImpl = async () => [{ key: 'order.receipt' }];
    const res = await TemplatesGet(getCtx());
    expect(res.status).toBe(200);
  });
});

describe('POST /api/api-keys — scope defaulting', () => {
  const admin = {
    kind: 'user' as const,
    userId: 'admin',
    tenantId: 'default',
    permissions: PermissionSet.of([toFeatureKey('API_KEYS')]),
  };
  const issue = (body: unknown) => runWithContext({ tenantId: 'default', principal: admin }, async () => ApiKeysPost(postCtx(body)));

  it('no grants (dashboard form) → full feature catalog scope', async () => {
    const res = (await issue({ name: 'CI bot' })) as Response;
    expect(res.status).toBe(201);
    const granted = (state.issued!.scope.toArray() as string[]).slice().sort();
    expect(granted).toEqual([...FEATURE_CATALOG].sort());
    expect(granted.length).toBeGreaterThan(0);
  });

  it('explicit grants → honored verbatim', async () => {
    await issue({ name: 'scoped', grants: ['ORDERS'] });
    expect(state.issued!.scope.toArray()).toEqual([toFeatureKey('ORDERS')]);
  });

  it('explicit empty grants → empty scope (intentional scope-down still possible)', async () => {
    await issue({ name: 'locked', grants: [] });
    expect(state.issued!.scope.toArray()).toEqual([]);
  });
});
