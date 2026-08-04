import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  owns: true,
  acceptCalls: 0,
  declineCalls: 0,
}));

vi.mock('@/lib/storefront/sale-ownership', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storefront/sale-ownership')>()),
  ownsSale: async () => h.owns,
}));
vi.mock('@/composition/make-upsell', () => ({
  acceptUpsell: async () => {
    h.acceptCalls += 1;
    return { success: true, action: 'accepted' };
  },
  declineUpsell: async () => {
    h.declineCalls += 1;
    return { success: true, action: 'declined' };
  },
}));

import { POST } from '../upsell';

function ctx(body: unknown) {
  return {
    request: new Request('http://shop.test/api/shop/upsell', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    locals: {},
    params: {},
  } as never;
}

beforeEach(() => {
  h.owns = true;
  h.acceptCalls = 0;
  h.declineCalls = 0;
});

describe('POST /api/shop/upsell — ownership gate', () => {
  const accept = { parentOrderId: 'sale-1', trackingId: 't1', action: 'accept', variantId: 'v1' };

  it('403s and never charges when the session does not own the sale', async () => {
    h.owns = false;
    const res = await POST(ctx(accept));
    expect(res.status).toBe(403);
    expect(h.acceptCalls).toBe(0);
  });

  it('403s on decline too, so state is never mutated by a stranger', async () => {
    h.owns = false;
    const res = await POST(ctx({ ...accept, action: 'decline' }));
    expect(res.status).toBe(403);
    expect(h.declineCalls).toBe(0);
  });

  it('proceeds when the session owns the sale', async () => {
    const res = await POST(ctx(accept));
    expect(res.status).toBe(200);
    expect(h.acceptCalls).toBe(1);
  });

  it('still 400s on a malformed body before any ownership work', async () => {
    const res = await POST(ctx({ parentOrderId: '', trackingId: 't1', action: 'accept' }));
    expect(res.status).toBe(400);
    expect(h.acceptCalls).toBe(0);
  });
});
