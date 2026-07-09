import { describe, it, expect, vi } from 'vitest';
import { handleCheckoutRequest } from './checkout-api-adapter';

function fakeSurface() {
  return {
    submitCheckout: { execute: vi.fn(async () => ({ saleRef: 'sale_1', clientHandle: 'cs_1', status: 'awaiting_capture' })) },
    addToCart: { execute: vi.fn(async () => undefined) },
    applyCoupon: { execute: vi.fn(async () => ({ discountMinor: 200 })) },
    advanceStep: { execute: vi.fn(async () => 'upsell-1') },
    oneClickUpsell: { execute: vi.fn(async () => ({ saleRef: 's2', clientHandle: 'cs_2' })) },
    sessions: { verifyCookieValue: vi.fn(async () => 'sess_1'), signCookieValue: vi.fn(async () => 'sess_1.sig') },
  } as any;
}

describe('handleCheckoutRequest', () => {
  it('submit returns awaiting_capture + clientHandle, never paid (H1)', async () => {
    const res = await handleCheckoutRequest('submit', { buyer: {}, captureMethod: 'automatic' }, 'sess_1.sig', fakeSurface());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ clientHandle: 'cs_1', status: 'awaiting_capture' });
    expect(res.body).not.toHaveProperty('paid');
  });

  it('rejects an action with a missing/invalid session cookie where one is required', async () => {
    const surface = fakeSurface();
    surface.sessions.verifyCookieValue = vi.fn(async () => null);
    const res = await handleCheckoutRequest('coupon', { code: 'X' }, 'tampered', surface);
    expect(res.status).toBe(401);
  });

  it('returns 400 for an unknown action', async () => {
    const res = await handleCheckoutRequest('bogus', {}, null, fakeSurface());
    expect(res.status).toBe(400);
  });

  it('maps a thrown domain error to a safe 422 without leaking internals', async () => {
    const surface = fakeSurface();
    surface.applyCoupon.execute = vi.fn(async () => { throw new Error('Subtotal below coupon minimum'); });
    const res = await handleCheckoutRequest('coupon', { code: 'X' }, 'sess_1.sig', surface);
    expect(res.status).toBe(422);
    expect(res.body.error).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/stack/i);
  });
});
