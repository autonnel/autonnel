import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  owns: true,
  confirmCalls: 0,
  finalizeCalls: 0,
  confirmResult: { status: 'requires_action', clientSecret: 'pi_secret_XYZ' } as Record<string, unknown>,
}));

vi.mock('@/lib/storefront/sale-ownership', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storefront/sale-ownership')>()),
  ownsSale: async () => h.owns,
}));
vi.mock('@/composition/make-payments', () => ({
  makeConfirmCardPayment: () => ({
    confirm: async () => {
      h.confirmCalls += 1;
      return h.confirmResult;
    },
    finalize: async () => {
      h.finalizeCalls += 1;
      return { status: 'succeeded' };
    },
  }),
}));
vi.mock('@/composition/run-checkout-drain', () => ({ runCheckoutDrain: async () => {} }));
vi.mock('@/lib/tenant/context', () => ({ getCurrentTenantId: () => 'default' }));
vi.mock('@/lib/db', () => ({ getBasePrisma: () => ({ paymentIntent: { update: async () => ({}) } }) }));
vi.mock('@/lib/funnel-next-step', () => ({ funnelNextStepIsUpsell: async () => false }));

import { POST } from '../payment/stripe';

function ctx(body: unknown) {
  return {
    request: new Request('http://shop.test/api/shop/payment/stripe', {
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
  h.confirmCalls = 0;
  h.finalizeCalls = 0;
  h.confirmResult = { status: 'requires_action', clientSecret: 'pi_secret_XYZ' };
});

describe('POST /api/shop/payment/stripe — ownership gate', () => {
  it('403s on confirm and never leaks the 3DS client secret', async () => {
    h.owns = false;
    const res = await POST(ctx({ action: 'confirm', orderId: 'sale-1', paymentMethodId: 'pm_1' }));
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('pi_secret_XYZ');
    expect(h.confirmCalls).toBe(0);
  });

  it('403s on finalize', async () => {
    h.owns = false;
    const res = await POST(ctx({ action: 'finalize', orderId: 'sale-1' }));
    expect(res.status).toBe(403);
    expect(h.finalizeCalls).toBe(0);
  });

  it('proceeds and returns the client secret to the owning session', async () => {
    const res = await POST(ctx({ action: 'confirm', orderId: 'sale-1', paymentMethodId: 'pm_1' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('pi_secret_XYZ');
    expect(h.confirmCalls).toBe(1);
  });
});
