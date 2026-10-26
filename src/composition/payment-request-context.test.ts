import { describe, it, expect, vi } from 'vitest';

const clientIp = vi.hoisted(() => ({ value: 'unknown' }));
vi.mock('@/lib/api/client-ip', () => ({ getClientIp: () => clientIp.value }));

import { buildPaymentRequestContext, checkoutRequestInfo, returnTargetsOf, snapshotWithReturnTargets, safeLocalPath } from './payment-request-context';

const snapshot = {
  sessionId: 'sess_1', visitorId: null, funnelId: 'f1', locale: 'en',
  buyer: { fullName: 'Ada Lovelace', address: { line1: '1 Main', city: 'Austin', region: 'TX', countryCode: 'US', postalCode: '73301' }, channel: 'email' as const, normalized: 'ada@example.com', hashedIdentity: 'h1' },
  lines: [{ variantExternalId: 'v1', title: 'Widget', quantity: 2, unitPriceMinor: 1250, currencyCode: 'USD', capturedAt: '2026-10-13T00:00:00Z' }],
};

describe('payment request context', () => {
  it('builds buyer, lines and provider URLs', () => {
    const ctx = buildPaymentRequestContext({
      slug: 'ACME', saleRef: 'sale-1', snapshot,
      request: { origin: 'https://shop.example', clientIp: '1.2.3.4', userAgent: 'UA', returnTo: '/thanks?x=1', cancelTo: '/checkout', pageId: 'p1', funnelId: 'f1' },
    });
    expect(ctx.buyer).toEqual({ email: 'ada@example.com', fullName: 'Ada Lovelace', shopperId: 'h1', address: snapshot.buyer.address });
    expect(ctx.lines).toEqual([{ sku: 'v1', title: 'Widget', quantity: 2, unitPriceMinor: 1250, currencyCode: 'USD' }]);
    expect(ctx.notifyUrl).toBe('https://shop.example/api/shop/payment/webhook/acme');
    expect(ctx.returnUrl).toBe('https://shop.example/api/shop/payment/return/acme?saleRef=sale-1');
    expect(ctx.returnUrl!.length).toBeLessThan(120);
    expect(ctx.clientIp).toBe('1.2.3.4');
    expect(ctx.sessionId).toBe('sess_1');
  });

  it('maps request fields to return targets', () => {
    expect(returnTargetsOf({ origin: 'https://s', returnTo: '/a', cancelTo: '/b', pageId: 'p', funnelId: 'f' })).toEqual({ next: '/a', cancel: '/b', pageId: 'p', funnelId: 'f' });
    expect(returnTargetsOf({ origin: 'https://s' })).toBeUndefined();
    expect(returnTargetsOf(undefined)).toBeUndefined();
  });

  it('adds return targets to the snapshot only when present', () => {
    expect(snapshotWithReturnTargets(snapshot, { origin: 'https://s', returnTo: '/a' })).toEqual({ ...snapshot, returnTargets: { next: '/a' } });
    expect(snapshotWithReturnTargets(snapshot, { origin: 'https://s' })).toBe(snapshot);
    expect(snapshotWithReturnTargets(undefined, undefined)).toBeUndefined();
  });

  it('uses the phone channel when the buyer has no email', () => {
    const ctx = buildPaymentRequestContext({ slug: 'ACME', saleRef: 's', snapshot: { ...snapshot, buyer: { ...snapshot.buyer, channel: 'phone', normalized: '+15550100' } } });
    expect(ctx.buyer.email).toBeUndefined();
    expect(ctx.buyer.phone).toBe('+15550100');
    expect(ctx.returnUrl).toBeUndefined();
  });

  it('accepts only same-site paths', () => {
    expect(safeLocalPath('/a?b=1', '/')).toBe('/a?b=1');
    expect(safeLocalPath('https://evil.example/x', '/')).toBe('/');
    expect(safeLocalPath('//evil.example/x', '/')).toBe('/');
    expect(safeLocalPath('/\\evil.example', '/')).toBe('/');
    expect(safeLocalPath('/\t/evil.example', '/')).toBe('/');
    expect(safeLocalPath('/\n/evil.example', '/')).toBe('/');
    expect(safeLocalPath('/\r/evil.example', '/')).toBe('/');
    expect(safeLocalPath(42, '/fallback')).toBe('/fallback');
  });

  it('reads client facts from the request', () => {
    clientIp.value = '9.9.9.9';
    const req = new Request('https://shop.example/api/checkout/submit', { headers: { 'cf-connecting-ip': '9.9.9.9', 'user-agent': 'UA' } });
    const info = checkoutRequestInfo(req, '127.0.0.1', { returnTo: '/next', cancelTo: 'https://evil/x', pageId: 'p', funnelId: 'f' });
    expect(info).toEqual({ origin: 'https://shop.example', clientIp: '9.9.9.9', userAgent: 'UA', returnTo: '/next', cancelTo: undefined, pageId: 'p', funnelId: 'f' });
  });

  it('falls back to the socket address when the helper cannot attribute the request', () => {
    clientIp.value = 'unknown';
    const info = checkoutRequestInfo(new Request('https://shop.example/x'), '127.0.0.1', {});
    expect(info.clientIp).toBe('127.0.0.1');
  });

  it.each([
    [undefined, 'http://shop.example'],
    ['https', 'https://shop.example'],
    ['https, http', 'https://shop.example'],
    ['garbage', 'http://shop.example'],
  ])('derives origin with x-forwarded-proto %s', (proto, expected) => {
    const headers: Record<string, string> = proto ? { 'x-forwarded-proto': proto } : {};
    const info = checkoutRequestInfo(new Request('http://shop.example/x', { headers }), undefined, {});
    expect(info.origin).toBe(expected);
  });
});
