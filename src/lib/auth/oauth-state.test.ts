import { describe, it, expect, afterEach, vi } from 'vitest';
import { issueOAuthState, consumeRelayState, OAuthStateError } from './oauth-state';

afterEach(() => {
  vi.useRealTimers();
});

describe('consumeRelayState', () => {
  it('accepts a freshly issued state and returns the tenant and user that started the flow', async () => {
    const state = await issueOAuthState({ platform: 'META', tenantId: 'tenant-1', userId: 'user-1' });
    const claim = await consumeRelayState(state);
    expect(claim).toEqual({ platform: 'META', tenantId: 'tenant-1', userId: 'user-1' });
  });

  it('rejects a state whose signature was tampered with', async () => {
    const state = await issueOAuthState({ platform: 'META', tenantId: 'tenant-1', userId: 'user-1' });
    const [body] = state.split('.');
    const tampered = `${body}.not-a-real-signature`;
    await expect(consumeRelayState(tampered)).rejects.toBeInstanceOf(OAuthStateError);
  });

  it('rejects the same state twice, because the nonce is single use', async () => {
    const state = await issueOAuthState({ platform: 'GOOGLE', tenantId: 'tenant-2', userId: 'user-2' });
    await consumeRelayState(state);
    await expect(consumeRelayState(state)).rejects.toBeInstanceOf(OAuthStateError);
  });

  it('rejects a state whose nonce has expired from the cache', async () => {
    vi.useFakeTimers();
    try {
      const state = await issueOAuthState({ platform: 'META', tenantId: 'tenant-3', userId: 'user-3' });
      vi.advanceTimersByTime(11 * 60 * 1000);
      await expect(consumeRelayState(state)).rejects.toBeInstanceOf(OAuthStateError);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a syntactically malformed state', async () => {
    await expect(consumeRelayState('not-a-valid-state-at-all')).rejects.toBeInstanceOf(OAuthStateError);
  });
});
