import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('@/lib/adapters/cache', () => ({
  getCache: () => ({
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    set: async (k: string, v: unknown) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
    deletePattern: async () => {},
  }),
  CACHE_TTL: { TEMPORARY: 60, SHORT: 300 },
}));
vi.mock('@/lib/services/session-secret', () => ({ resolveSessionSecret: () => 'test-secret' }));

import { issueOAuthState, consumeOAuthState, OAuthStateError } from '../oauth-state';

const owner = { tenantId: 'tenant-a', userId: 'user-1' };

beforeEach(() => {
  store.clear();
});

describe('OAuth state', () => {
  it('round-trips the platform for the issuing principal', async () => {
    const state = await issueOAuthState({ platform: 'FACEBOOK', ...owner });
    await expect(consumeOAuthState(state, owner)).resolves.toMatchObject({ platform: 'FACEBOOK' });
  });

  it('rejects a state that was not signed with the secret', async () => {
    const forged = Buffer.from(JSON.stringify({ platform: 'FACEBOOK', ...owner })).toString('base64url');
    await expect(consumeOAuthState(forged, owner)).rejects.toThrow(OAuthStateError);
  });

  it('rejects a tampered payload carrying a valid signature from another body', async () => {
    const state = await issueOAuthState({ platform: 'FACEBOOK', ...owner });
    const [, sig] = state.split('.');
    const swapped = `${Buffer.from(JSON.stringify({ platform: 'TIKTOK', ...owner })).toString('base64url')}.${sig}`;
    await expect(consumeOAuthState(swapped, owner)).rejects.toThrow(OAuthStateError);
  });

  it('rejects consumption by a different user', async () => {
    const state = await issueOAuthState({ platform: 'FACEBOOK', ...owner });
    await expect(consumeOAuthState(state, { tenantId: 'tenant-a', userId: 'user-2' })).rejects.toThrow(OAuthStateError);
  });

  it('rejects consumption in a different tenant', async () => {
    const state = await issueOAuthState({ platform: 'FACEBOOK', ...owner });
    await expect(consumeOAuthState(state, { tenantId: 'tenant-b', userId: 'user-1' })).rejects.toThrow(OAuthStateError);
  });

  it('is single-use', async () => {
    const state = await issueOAuthState({ platform: 'FACEBOOK', ...owner });
    await consumeOAuthState(state, owner);
    await expect(consumeOAuthState(state, owner)).rejects.toThrow(OAuthStateError);
  });

  it('rejects a state whose nonce was never issued', async () => {
    const state = await issueOAuthState({ platform: 'FACEBOOK', ...owner });
    store.clear();
    await expect(consumeOAuthState(state, owner)).rejects.toThrow(OAuthStateError);
  });

  it('never returns an attacker-supplied externalAccountId', async () => {
    const state = await issueOAuthState({ platform: 'FACEBOOK', ...owner });
    const out = await consumeOAuthState(state, owner);
    expect(out.externalAccountId).toBe('');
  });
});
