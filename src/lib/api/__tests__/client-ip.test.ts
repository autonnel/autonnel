import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ trustedProxy: undefined as string | undefined, cloudflare: false }));

vi.mock('@/lib/runtime/env', () => ({
  readEnv: (key: string) => (key === 'TRUSTED_PROXY' ? h.trustedProxy : undefined),
  isCloudflareRuntime: () => h.cloudflare,
}));

import { getClientIp } from '../client-ip';

const req = (headers: Record<string, string>) => new Request('http://app.test/', { headers });

beforeEach(() => {
  h.trustedProxy = undefined;
  h.cloudflare = false;
});

describe('getClientIp — trusted-proxy boundary', () => {
  it('ignores forwarding headers on a direct deployment by default', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '5.6.7.8' }))).toBe('unknown');
  });

  it('does not let an attacker rotate buckets when untrusted', () => {
    const a = getClientIp(req({ 'x-forwarded-for': '1.1.1.1' }));
    const b = getClientIp(req({ 'x-forwarded-for': '2.2.2.2' }));
    expect(a).toBe(b);
  });

  it('trusts cf-connecting-ip on the workerd runtime by default', () => {
    h.cloudflare = true;
    expect(getClientIp(req({ 'cf-connecting-ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });

  it('ignores x-forwarded-for in cloudflare mode', () => {
    h.trustedProxy = 'cloudflare';
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4' }))).toBe('unknown');
  });

  it('uses the first forwarded hop when explicitly configured', () => {
    h.trustedProxy = 'forwarded';
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip in forwarded mode', () => {
    h.trustedProxy = 'forwarded';
    expect(getClientIp(req({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
  });

  it('honours an explicit none even on cloudflare', () => {
    h.cloudflare = true;
    h.trustedProxy = 'none';
    expect(getClientIp(req({ 'cf-connecting-ip': '5.6.7.8' }))).toBe('unknown');
  });

  it('treats an unrecognized value as none', () => {
    h.trustedProxy = 'wat';
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4' }))).toBe('unknown');
  });
});
