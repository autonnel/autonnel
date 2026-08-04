import { describe, it, expect, vi, beforeEach } from 'vitest';

const readEnv = vi.fn();
vi.mock('@/lib/runtime/env', () => ({ readEnv: (key: string) => readEnv(key) }));

const { resolveSessionSecret } = await import('./session-secret');

describe('resolveSessionSecret', () => {
  beforeEach(() => {
    readEnv.mockReset();
    readEnv.mockImplementation((key: string) => (key === 'NODE_ENV' ? 'production' : undefined));
  });

  it('reads the requested key from the supplied env record', () => {
    expect(resolveSessionSecret('AUTH_SESSION_SECRET', { AUTH_SESSION_SECRET: 's1' })).toBe('s1');
  });

  it('prefers the first key in the chain when both are set', () => {
    const env = { CHECKOUT_COOKIE_SECRET: 'checkout', AUTH_SESSION_SECRET: 'auth' };
    expect(resolveSessionSecret(['CHECKOUT_COOKIE_SECRET', 'AUTH_SESSION_SECRET'], env)).toBe('checkout');
  });

  // Regression: requiring CHECKOUT_COOKIE_SECRET outright threw during checkout dependency
  // assembly on every deployment that only set AUTH_SESSION_SECRET, taking the storefront
  // checkout API down with an empty 500 while pages kept rendering.
  it('falls back to the next key in the chain when the first is unset', () => {
    const env = { AUTH_SESSION_SECRET: 'auth' };
    expect(resolveSessionSecret(['CHECKOUT_COOKIE_SECRET', 'AUTH_SESSION_SECRET'], env)).toBe('auth');
  });

  it('throws naming every candidate key when none resolve outside dev/test', () => {
    expect(() => resolveSessionSecret(['CHECKOUT_COOKIE_SECRET', 'AUTH_SESSION_SECRET'], {})).toThrow(
      /CHECKOUT_COOKIE_SECRET or AUTH_SESSION_SECRET is required/,
    );
  });

  it('allows the public dev fallback only when NODE_ENV is development or test', () => {
    readEnv.mockImplementation((key: string) => (key === 'NODE_ENV' ? 'development' : undefined));
    expect(resolveSessionSecret(['CHECKOUT_COOKIE_SECRET', 'AUTH_SESSION_SECRET'], {})).toBe('dev-insecure-secret');
  });
});
