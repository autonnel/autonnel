import { describe, it, expect, beforeEach, vi } from 'vitest';

// A key must never carry a grant its creator does not hold. The data side is faked;
// only the scope-derivation behaviour is asserted.
const state = vi.hoisted(() => ({
  issued: undefined as { scope: { toArray(): string[] } } | undefined,
}));

vi.mock('@/composition/identity-deps', () => ({ resolveIdentityDeps: () => ({}) }));
vi.mock('@/composition/make-identity', () => ({
  makeIdentity: () => ({
    apiKeys: {
      issue: async (input: { scope: { toArray(): string[] } }) => {
        state.issued = input;
        return { id: 'k1', prefix: 'sk_test01', plaintext: 'sk_test01_secret' };
      },
      list: async () => [],
    },
  }),
}));

import { POST } from './index';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';

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

function asUser(features: string[]) {
  return {
    kind: 'user' as const,
    userId: 'u1',
    tenantId: 'default',
    permissions: PermissionSet.of(features.map(toFeatureKey)),
  };
}

const issueAs = (features: string[], body: unknown) =>
  runWithContext({ tenantId: 'default', principal: asUser(features) }, async () => POST(postCtx(body)));

beforeEach(() => {
  state.issued = undefined;
});

describe('POST /api/api-keys — grants may never exceed the creator', () => {
  it('API_KEYS-only creator with no grants gets an API_KEYS-only key', async () => {
    const res = (await issueAs(['API_KEYS'], { name: 'bot' })) as Response;
    expect(res.status).toBe(201);
    expect(state.issued!.scope.toArray()).toEqual([toFeatureKey('API_KEYS')]);
  });

  it('requesting ORDERS without holding ORDERS is rejected', async () => {
    const res = (await issueAs(['API_KEYS'], { name: 'bot', grants: ['ORDERS'] })) as Response;
    expect(res.status).toBe(403);
    expect(state.issued).toBeUndefined();
  });

  it('requesting a subset the creator holds is honoured', async () => {
    const res = (await issueAs(['API_KEYS', 'ORDERS', 'PAGES'], { name: 'bot', grants: ['ORDERS'] })) as Response;
    expect(res.status).toBe(201);
    expect(state.issued!.scope.toArray()).toEqual([toFeatureKey('ORDERS')]);
  });

  it('omitted grants default to the creator full scope, not the catalog', async () => {
    const res = (await issueAs(['API_KEYS', 'ORDERS'], { name: 'bot' })) as Response;
    expect(res.status).toBe(201);
    expect(state.issued!.scope.toArray().sort()).toEqual([toFeatureKey('API_KEYS'), toFeatureKey('ORDERS')].sort());
  });

  it('explicit empty grants still produce an empty scope', async () => {
    const res = (await issueAs(['API_KEYS', 'ORDERS'], { name: 'locked', grants: [] })) as Response;
    expect(res.status).toBe(201);
    expect(state.issued!.scope.toArray()).toEqual([]);
  });
});
