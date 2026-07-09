import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  intentRow: null as Record<string, unknown> | null,
  priorTxn: null as Record<string, unknown> | null,
  txnCreate: vi.fn(async () => ({})),
  chargeOffSession: vi.fn(),
  patchOrderAmount: vi.fn(async () => {}),
  resolvePurchasables: vi.fn(),
  orderSave: vi.fn(async () => {}),
  addUpsellLine: vi.fn(),
  captureNow: vi.fn(),
  updateSnapshot: vi.fn(async () => {}),
  enqueueJob: vi.fn(async (_kind?: string, _key?: unknown, _payload?: unknown) => {}),
  piUpdate: vi.fn(async (_args?: { data: Record<string, unknown> }) => ({})),
  submitIndependentUpsell: vi.fn(async (_args?: unknown) => {}),
  nextIsUpsell: false,
  funnelStepUrl: '/thank-you?x=1' as string | '',
}));

vi.mock('@/lib/tenant/context', () => ({ getCurrentTenantId: () => 'default' }));
vi.mock('@/composition/run-checkout-drain', () => ({ runCheckoutDrain: vi.fn(async () => {}) }));
vi.mock('@/lib/storefront/storefront-data.service', () => ({
  getFunnelContext: vi.fn(async () => ({ stepUrl: h.funnelStepUrl, funnelId: 'f1', funnelPageType: 'UPSELL', stepIndex: 2 })),
}));
vi.mock('@/lib/db', () => ({
  getBasePrisma: () => ({
    paymentIntent: { findUnique: vi.fn(async () => h.intentRow), update: h.piUpdate },
    order: { findUnique: vi.fn(async () => ({ address: { countryCode: 'US' } })) },
    transaction: { findUnique: vi.fn(async () => h.priorTxn) },
  }),
}));
vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => ({ transaction: { create: h.txnCreate } }),
}));
vi.mock('@/composition/make-commerce-gateway', () => ({
  makeCommerceGatewayReadSide: async () => ({ resolvePurchasables: h.resolvePurchasables }),
}));
vi.mock('@/modules/payments/infra/providers/provider-factory', () => ({
  createPaymentProvider: async () => ({ chargeOffSession: h.chargeOffSession, patchOrderAmount: h.patchOrderAmount }),
}));
vi.mock('@/modules/payments/infra/config/tenant-config.adapter', () => ({
  AppConfigTenantConfigAdapter: class { async providerConfig() { return {}; } },
}));
vi.mock('@/modules/payments/infra/prisma/payment-intent.repository', () => ({
  PrismaPaymentIntentRepository: class { updateCheckoutSnapshotBySaleRef = h.updateSnapshot; },
}));
vi.mock('@/composition/make-payments', () => ({ makeConfirmPayPalOrder: () => ({ captureNow: h.captureNow }) }));
vi.mock('@/lib/funnel-next-step', () => ({ funnelNextStepIsUpsell: async () => h.nextIsUpsell }));
vi.mock('@/composition/storefront-runtime', () => ({ storefrontCheckoutDepsFromLocals: () => ({ tenantId: 'default', jobQueue: { enqueue: h.enqueueJob } }) }));
vi.mock('@/composition/handoff-coordinator', () => ({ submitIndependentUpsell: h.submitIndependentUpsell }));
vi.mock('@/modules/order-fulfillment/infra/prisma/order.repository', () => ({
  PrismaOrderRepository: class {
    async findBySaleRef() {
      return {
        id: 'order_1', orderNumber: 'A100',
        addUpsellLine: h.addUpsellLine,
        save: h.orderSave,
        capturedTotal: { amountMinor: 3500, currencyCode: 'USD' },
        lines: [{ externalRef: 'v1', title: 'Upsell', quantity: 1, unitPrice: { amountMinor: 1500 } }],
      };
    }
    save = h.orderSave;
  },
}));

import { acceptUpsell, declineUpsell } from './make-upsell';

const baseInput = {
  trackingId: 'trk_1', parentOrderId: 'sale_1', action: 'accept' as const,
  productId: 'v1', variantId: 'v1', quantity: 1, upsellIndex: 0, funnelId: 'f1', pageId: 'page_up',
};

beforeEach(() => {
  vi.clearAllMocks();
  h.intentRow = { id: 'pi_1', provider: 'STRIPE', status: 'CAPTURED', currencyCode: 'USD', providerIntentId: null, stripeCustomerId: 'cus_1', stripePaymentMethodId: 'pm_1', captureDeferred: false, handoffDeferred: false, checkoutSnapshot: { lines: [{ variantExternalId: 'base', title: 'Base', quantity: 1, unitPriceMinor: 2000, currencyCode: 'USD', capturedAt: 'now' }] } };
  h.priorTxn = null;
  h.funnelStepUrl = '/thank-you?x=1';
  h.nextIsUpsell = false;
  h.resolvePurchasables.mockResolvedValue([{ variantRef: { toString: () => 'v1' }, title: 'Boost Serum', price: { amountMinor: 1500, currencyCode: 'USD' }, sellability: { verdict: 'available' } }]);
  h.chargeOffSession.mockResolvedValue({ status: 'CAPTURED', capture: { providerChargeId: 'ch_up', capturedAmountMinor: 1500, currencyCode: 'USD', capturedAt: new Date().toISOString() } });
  h.captureNow.mockResolvedValue({ status: 'succeeded' });
});

function paypalIntent(snapshotLines: unknown[] = [{ variantExternalId: 'base', title: 'Base', quantity: 1, unitPriceMinor: 2000, currencyCode: 'USD', capturedAt: 'now' }]) {
  return { id: 'pi_1', provider: 'PAYPAL', status: 'AUTHORIZED', currencyCode: 'USD', providerIntentId: 'order_1', captureDeferred: true, handoffDeferred: false, stripeCustomerId: null, stripePaymentMethodId: null, checkoutSnapshot: { lines: snapshotLines } };
}

describe('acceptUpsell (PayPal patch-merge)', () => {
  it('patches the order total + appends a snapshot line and (last upsell) captures once', async () => {
    h.intentRow = paypalIntent();
    h.nextIsUpsell = false; // last upsell → capture now
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(true);
    expect(h.chargeOffSession).not.toHaveBeenCalled(); // PayPal never charges off-session
    expect(h.patchOrderAmount).toHaveBeenCalledOnce();
    expect(h.patchOrderAmount.mock.calls[0]).toEqual(['order_1', 'USD', 3500]); // 2000 base + 1500 upsell
    expect(h.updateSnapshot).toHaveBeenCalledOnce();
    expect(h.captureNow).toHaveBeenCalledOnce();
  });

  it('does NOT capture when another upsell follows (patch only)', async () => {
    h.intentRow = paypalIntent();
    h.nextIsUpsell = true; // more upsells ahead
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(true);
    expect(h.patchOrderAmount).toHaveBeenCalledOnce();
    expect(h.captureNow).not.toHaveBeenCalled();
  });

  it('is idempotent: a re-POST for the same upsellIndex does not patch the amount twice', async () => {
    h.intentRow = paypalIntent([
      { variantExternalId: 'base', title: 'Base', quantity: 1, unitPriceMinor: 2000, currencyCode: 'USD', capturedAt: 'now' },
      { variantExternalId: 'v1', title: 'Boost Serum', quantity: 1, unitPriceMinor: 1500, currencyCode: 'USD', capturedAt: 'now', upsellIndex: 0 },
    ]);
    h.nextIsUpsell = true;
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(true);
    expect(h.patchOrderAmount).not.toHaveBeenCalled();
    expect(h.updateSnapshot).not.toHaveBeenCalled();
  });

  it('rejects when the order is not in the deferred AUTHORIZED state', async () => {
    h.intentRow = { ...paypalIntent(), captureDeferred: false, status: 'CAPTURED' };
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(false);
    expect(h.patchOrderAmount).not.toHaveBeenCalled();
  });
});

describe('declineUpsell (PayPal last-step capture)', () => {
  it('captures the held order when declining the LAST upsell', async () => {
    h.intentRow = paypalIntent();
    h.nextIsUpsell = false;
    const dto = await declineUpsell({ ...baseInput, action: 'decline' }, {});
    expect(dto.success).toBe(true);
    expect(h.captureNow).toHaveBeenCalledOnce();
  });

  it('does NOT capture when declining a non-last upsell', async () => {
    h.intentRow = paypalIntent();
    h.nextIsUpsell = true;
    const dto = await declineUpsell({ ...baseInput, action: 'decline' }, {});
    expect(dto.success).toBe(true);
    expect(h.captureNow).not.toHaveBeenCalled();
  });
});

describe('acceptUpsell (Stripe off-session)', () => {
  it('charges the saved method, records a CHARGE, appends the order line, returns nextStepUrl', async () => {
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(true);
    expect(dto.action).toBe('accepted');
    expect(h.chargeOffSession).toHaveBeenCalledOnce();
    const chargeArg = h.chargeOffSession.mock.calls[0][0];
    expect(chargeArg.idempotencyKey).toBe('upsell:sale_1:0');
    expect(chargeArg.amountMinor).toBe(1500);
    expect(chargeArg.paymentMethodId).toBe('pm_1');
    expect(h.txnCreate).toHaveBeenCalledOnce();
    const txnArg = (h.txnCreate.mock.calls[0] as unknown as [{ data: { idempotencyKey: string; parentTransactionId: string } }])[0];
    expect(txnArg.data.idempotencyKey).toBe('upsell:sale_1:0');
    expect(txnArg.data.parentTransactionId).toBe('pi_1');
    expect(h.addUpsellLine).toHaveBeenCalledOnce();
    expect(dto.nextStepUrl).toContain('/thank-you');
    expect(dto.nextStepUrl).toContain('orderId=sale_1');
  });

  it('is idempotent: a prior charge for (sale,index) does NOT charge again', async () => {
    h.priorTxn = { id: 'txn_prev' };
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(true);
    expect(h.chargeOffSession).not.toHaveBeenCalled();
    expect(h.txnCreate).not.toHaveBeenCalled();
  });

  it('declined card → success:false, no CHARGE recorded, still returns nextStepUrl', async () => {
    h.chargeOffSession.mockResolvedValue({ status: 'FAILED', error: { code: 'card_declined' } });
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(false);
    expect(h.txnCreate).not.toHaveBeenCalled();
    expect(h.addUpsellLine).not.toHaveBeenCalled();
    expect(dto.nextStepUrl).toContain('/thank-you');
  });

  it('SCA required → success:false with authentication message', async () => {
    h.chargeOffSession.mockResolvedValue({ status: 'REQUIRES_ACTION' });
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(false);
    expect(dto.error).toMatch(/authentication/i);
  });

  it('non-Stripe provider is rejected (Phase A) without charging', async () => {
    h.intentRow = { ...h.intentRow!, provider: 'PAYPAL' };
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(false);
    expect(h.chargeOffSession).not.toHaveBeenCalled();
  });

  it('missing saved method → success:false without charging', async () => {
    h.intentRow = { ...h.intentRow!, stripePaymentMethodId: null };
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(false);
    expect(h.chargeOffSession).not.toHaveBeenCalled();
  });

  it('unknown order → success:false', async () => {
    h.intentRow = null;
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(false);
    expect(dto.error).toMatch(/not found/i);
  });

  it('merged ecommerce push: when handoffDeferred, charges + syncs snapshot/total + fires ONE handoff on the last upsell', async () => {
    h.intentRow = { ...h.intentRow!, handoffDeferred: true };
    h.nextIsUpsell = false; // last upsell → trigger the held merged push
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(true);
    expect(h.chargeOffSession).toHaveBeenCalledOnce();   // Stripe still charges separately
    expect(h.updateSnapshot).toHaveBeenCalledOnce();     // snapshot line added for the merged push
    expect(h.enqueueJob).toHaveBeenCalledOnce();         // ONE merged ecommerce push enqueued
    expect(h.enqueueJob.mock.calls[0][0]).toBe('commerce.handoff');
    // capturedMinor incremented (handoff total) + handoffDeferred cleared
    const updates = h.piUpdate.mock.calls.map((c) => c[0]!.data);
    expect(updates.some((d) => d.capturedMinor)).toBe(true);
    expect(updates.some((d) => d.handoffDeferred === false)).toBe(true);
  });

  it('merged ecommerce push: NOT fired while more upsells remain (only snapshot synced)', async () => {
    h.intentRow = { ...h.intentRow!, handoffDeferred: true };
    h.nextIsUpsell = true; // more upsells → hold the push
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(true);
    expect(h.updateSnapshot).toHaveBeenCalledOnce();
    expect(h.enqueueJob).not.toHaveBeenCalled();
  });

  it('late-degrade: main handoff already fired (handoffDeferred=false) → pushes an independent order tagged to the parent', async () => {
    h.intentRow = {
      ...h.intentRow!,
      handoffDeferred: false,
      checkoutSnapshot: { lines: [{ variantExternalId: 'base', title: 'Base', quantity: 1, unitPriceMinor: 2000, currencyCode: 'USD', capturedAt: 'now' }], buyer: { fullName: 'Ada', hashedIdentity: 'h:ada', address: { line1: '1' }, channel: 'email', normalized: 'ada@example.com' } },
    };
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(true);
    expect(h.enqueueJob).not.toHaveBeenCalled();        // not a merged push
    expect(h.updateSnapshot).not.toHaveBeenCalled();    // not accumulated into the merged snapshot
    expect(h.submitIndependentUpsell).toHaveBeenCalledOnce();
    const arg = h.submitIndependentUpsell.mock.calls[0][0] as {
      parentOrderNumber: string; upsellIndex: number; line: Record<string, unknown>; customer: Record<string, unknown>;
    };
    expect(arg.parentOrderNumber).toBe('A100');
    expect(arg.upsellIndex).toBe(0);
    expect(arg.line).toEqual({ variantExternalId: 'v1', quantity: 1, unitPriceMinor: 1500, currencyCode: 'USD' });
    expect(arg.customer.email).toBe('ada@example.com');
  });
});

describe('declineUpsell', () => {
  it('records nothing, charges nothing, returns nextStepUrl', async () => {
    const dto = await declineUpsell({ ...baseInput, action: 'decline' });
    expect(dto.success).toBe(true);
    expect(dto.action).toBe('declined');
    expect(h.chargeOffSession).not.toHaveBeenCalled();
    expect(h.txnCreate).not.toHaveBeenCalled();
    expect(dto.nextStepUrl).toContain('/thank-you');
  });
});
