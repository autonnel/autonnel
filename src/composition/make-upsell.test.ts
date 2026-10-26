import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  intentRow: null as Record<string, unknown> | null,
  priorTxn: null as Record<string, unknown> | null,
  txnCreate: vi.fn(async (_args?: { data: Record<string, unknown> }) => ({})),
  chargeOffSession: vi.fn(),
  createIntent: vi.fn(),
  getIntent: vi.fn(),
  findMany: vi.fn(async (_args?: unknown) => [] as unknown[]),
  errorLog: vi.fn(),
  dispatchConversion: vi.fn(async (_e?: unknown, _l?: unknown) => {}),
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

vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: h.errorLog }) }));
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
  getTenantPrisma: () => ({ transaction: { create: h.txnCreate }, paymentIntent: { findMany: h.findMany } }),
}));
vi.mock('@/composition/make-commerce-gateway', () => ({
  makeCommerceGatewayReadSide: async () => ({ resolvePurchasables: h.resolvePurchasables }),
}));
vi.mock('@/modules/payments/infra/prisma/payment-intent.repository', () => ({
  PrismaPaymentIntentRepository: class { updateCheckoutSnapshotBySaleRef = h.updateSnapshot; },
}));
vi.mock('@/composition/make-payments', () => ({
  makeConfirmPayPalOrder: () => ({ captureNow: h.captureNow }),
  resolvePaymentProvider: async (slug: string) =>
    slug === 'PAYPAL' ? { patchOrderAmount: h.patchOrderAmount } : { chargeOffSession: h.chargeOffSession, createIntent: h.createIntent, getIntent: h.getIntent },
}));
vi.mock('./plugin-runtime', () => ({ dispatchPluginConversion: h.dispatchConversion, hasConversionSubscribers: () => true, loadVisitedUrls: async () => [] }));
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

import { acceptUpsell, declineUpsell, finalizeHostedUpsell, reconcilePendingHostedUpsells } from './make-upsell';

const baseInput = {
  trackingId: 'trk_1', parentOrderId: 'sale_1', action: 'accept' as const,
  productId: 'v1', variantId: 'v1', quantity: 1, upsellIndex: 0, funnelId: 'f1', pageId: 'page_up',
};

beforeEach(() => {
  vi.clearAllMocks();
  h.intentRow = { id: 'pi_1', provider: 'STRIPE', status: 'CAPTURED', currencyCode: 'USD', providerIntentId: null, stripeCustomerId: 'cus_1', stripePaymentMethodId: 'pm_1', vaultRef: null, captureDeferred: false, handoffDeferred: false, checkoutSnapshot: { lines: [{ variantExternalId: 'base', title: 'Base', quantity: 1, unitPriceMinor: 2000, currencyCode: 'USD', capturedAt: 'now' }] } };
  h.priorTxn = null;
  h.funnelStepUrl = '/thank-you?x=1';
  h.nextIsUpsell = false;
  h.resolvePurchasables.mockResolvedValue([{ variantRef: { toString: () => 'v1' }, title: 'Boost Serum', price: { amountMinor: 1500, currencyCode: 'USD' }, sellability: { verdict: 'available' } }]);
  h.chargeOffSession.mockResolvedValue({ status: 'CAPTURED', capture: { providerChargeId: 'ch_up', capturedAmountMinor: 1500, currencyCode: 'USD', capturedAt: new Date().toISOString() } });
  h.captureNow.mockResolvedValue({ status: 'succeeded' });
});

function paypalIntent(snapshotLines: unknown[] = [{ variantExternalId: 'base', title: 'Base', quantity: 1, unitPriceMinor: 2000, currencyCode: 'USD', capturedAt: 'now' }]) {
  return { id: 'pi_1', provider: 'PAYPAL', status: 'AUTHORIZED', currencyCode: 'USD', providerIntentId: 'order_1', captureDeferred: true, handoffDeferred: false, stripeCustomerId: null, stripePaymentMethodId: null, vaultRef: null, checkoutSnapshot: { lines: snapshotLines } };
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

  it('charges a plugin provider off-session with the generic vault ref and request context', async () => {
    h.intentRow = { id: 'i1', provider: 'ACME', status: 'CAPTURED', currencyCode: 'USD', providerIntentId: 's1', stripeCustomerId: null, stripePaymentMethodId: null, vaultRef: 'agr_1', captureDeferred: false, handoffDeferred: false, checkoutSnapshot: { lines: [], buyer: { fullName: 'A', hashedIdentity: 'h', address: {}, channel: 'email', normalized: 'a@b.co' } } };
    h.resolvePurchasables.mockResolvedValue([{ title: 'Up', price: { amountMinor: 500, currencyCode: 'USD' } }]);
    h.chargeOffSession.mockResolvedValue({ status: 'CAPTURED', capture: { providerChargeId: 'TR2', capturedAmountMinor: 500, currencyCode: 'USD', capturedAt: new Date().toISOString() } });
    const out = await acceptUpsell({ parentOrderId: 's1', trackingId: 't', action: 'accept', variantId: 'v9', upsellIndex: 0 } as never, undefined, { origin: 'https://shop.example', clientIp: '1.1.1.1' });
    expect(out.success).toBe(true);
    const call = h.chargeOffSession.mock.calls.at(-1)![0];
    expect(call.paymentMethodId).toBe('agr_1');
    expect(call.context.clientIp).toBe('1.1.1.1');
    expect(call.context.lines).toEqual([{ sku: 'v9', title: 'Up', quantity: 1, unitPriceMinor: 500, currencyCode: 'USD' }]);
    expect(h.txnCreate.mock.calls.at(-1)![0]!.data.provider).toBe('ACME');
  });

  it('waits for a late vault ref', async () => {
    vi.useFakeTimers();
    const base = { id: 'i1', provider: 'ACME', status: 'CAPTURED', currencyCode: 'USD', providerIntentId: 's1', stripeCustomerId: null, stripePaymentMethodId: null, captureDeferred: false, handoffDeferred: false, checkoutSnapshot: { lines: [] } };
    h.intentRow = { ...base, vaultRef: null };
    h.resolvePurchasables.mockResolvedValue([{ title: 'Up', price: { amountMinor: 500, currencyCode: 'USD' } }]);
    h.chargeOffSession.mockResolvedValue({ status: 'CAPTURED', capture: { providerChargeId: 'TR3', capturedAmountMinor: 500, currencyCode: 'USD', capturedAt: new Date().toISOString() } });
    const pending = acceptUpsell({ parentOrderId: 's1', trackingId: 't', action: 'accept', variantId: 'v9', upsellIndex: 1 } as never, undefined);
    await vi.advanceTimersByTimeAsync(1000);
    h.intentRow = { ...base, vaultRef: 'agr_late' };
    await vi.advanceTimersByTimeAsync(2000);
    const out = await pending;
    vi.useRealTimers();
    expect(out.success).toBe(true);
    expect(h.chargeOffSession.mock.calls.at(-1)![0].paymentMethodId).toBe('agr_late');
  });

  it('missing saved method → success:false without charging', async () => {
    vi.useFakeTimers();
    h.intentRow = { ...h.intentRow!, stripePaymentMethodId: null };
    const pending = acceptUpsell(baseInput, {});
    await vi.advanceTimersByTimeAsync(6000);
    const dto = await pending;
    vi.useRealTimers();
    expect(dto.success).toBe(false);
    expect(h.chargeOffSession).not.toHaveBeenCalled();
  });

  it('does not wait for a vault ref on a Stripe intent', async () => {
    h.intentRow = { ...h.intentRow!, stripePaymentMethodId: null };
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const dto = await acceptUpsell(baseInput, {});
    expect(timer).not.toHaveBeenCalled();
    timer.mockRestore();
    expect(dto.success).toBe(false);
    expect(dto.error).toBe('Saved payment method unavailable');
  });

  it.each(['pending_timeout', 'unknown_outcome'])('ambiguous charge outcome %s → still-confirming message and error log', async (code) => {
    h.chargeOffSession.mockResolvedValue({ status: 'FAILED', error: { code } });
    const dto = await acceptUpsell(baseInput, {});
    expect(dto.success).toBe(false);
    expect(dto.error).toBe('Your payment is still being confirmed. Please do not pay again; we will update your order shortly.');
    expect(h.errorLog).toHaveBeenCalledWith(expect.stringContaining('ambiguous'), expect.objectContaining({ saleRef: 'sale_1', upsellIndex: 0 }));
    expect(h.txnCreate).not.toHaveBeenCalled();
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

describe('hosted-page upsell fallback', () => {
  const hostedSnapshot = { lines: [], buyer: { fullName: 'A', hashedIdentity: 'h', address: {}, channel: 'email', normalized: 'a@b.co' }, returnTargets: { next: '/n' } };
  const hostedIntent = (snapshot: unknown = hostedSnapshot) => ({ id: 'i1', provider: 'ACME', status: 'CAPTURED', currencyCode: 'USD', providerIntentId: 's1', stripeCustomerId: null, stripePaymentMethodId: null, vaultRef: null, captureDeferred: false, handoffDeferred: false, checkoutSnapshot: snapshot, pendingUpsellSince: null as Date | null });
  const input = { parentOrderId: 's1', trackingId: 't', action: 'accept', variantId: 'v9', upsellIndex: 0, pageId: 'page_up', funnelId: 'f1', cancelTo: '/upsell-1' } as never;
  const request = { origin: 'https://shop.example', clientIp: '1.1.1.1', userAgent: 'UA' };

  beforeEach(() => {
    h.intentRow = hostedIntent();
    h.resolvePurchasables.mockResolvedValue([{ title: 'Up', price: { amountMinor: 500, currencyCode: 'USD' } }]);
    h.createIntent.mockResolvedValue({ providerRef: { provider: 'ACME', providerIntentId: 's1-u0-1' }, clientHandle: { provider: 'ACME', kind: 'redirect_url', value: 'https://pay.example/c/1' } });
    h.getIntent.mockResolvedValue({ status: 'PROCESSING' });
  });

  async function accept(rows = [hostedIntent()]) {
    h.intentRow = rows[0];
    const pending = acceptUpsell(input, undefined, request);
    await vi.advanceTimersByTimeAsync(6000);
    return pending;
  }

  it('without a vault ref creates a hosted session, stores the pending entry and returns a redirect', async () => {
    vi.useFakeTimers();
    const dto = await accept();
    vi.useRealTimers();
    expect(dto).toMatchObject({ success: true, action: 'redirect', redirectUrl: 'https://pay.example/c/1' });
    expect(h.chargeOffSession).not.toHaveBeenCalled();
    const arg = h.createIntent.mock.calls[0][0];
    expect(arg).toMatchObject({ amountMinor: 500, currencyCode: 'USD', captureMethod: 'automatic', idempotencyKey: 's1-u0-1', saleRef: 's1-u0-1' });
    expect(arg.context.returnUrl).toBe('https://shop.example/api/shop/payment/upsell-return/acme?saleRef=s1&n=0');
    expect(arg.context.notifyUrl).toBe('https://shop.example/api/shop/payment/webhook/acme');
    expect(arg.context.clientIp).toBe('1.1.1.1');
    expect(arg.context.lines).toEqual([{ sku: 'v9', title: 'Up', quantity: 1, unitPriceMinor: 500, currencyCode: 'USD' }]);
    expect(arg.context.buyer.email).toBe('a@b.co');
    const saved = (h.updateSnapshot.mock.calls[0] as unknown as [string, Record<string, any>])[1];
    expect(saved.returnTargets).toEqual({ next: '/n' });
    expect(saved.buyer.fullName).toBe('A');
    expect(saved.pendingUpsells['0']).toMatchObject({ upsellIndex: 0, sessionRef: 's1-u0-1', attempt: 1, cancelTo: '/upsell-1', pageId: 'page_up', funnelId: 'f1', line: { externalRef: 'v9', lineMinor: 500 } });
    expect(saved.pendingUpsells['0'].nextStepUrl).toContain('orderId=s1');
    expect(h.piUpdate.mock.calls.some((c) => c[0]!.data.pendingUpsellSince instanceof Date)).toBe(true);
  });

  it('a second click after the buyer abandoned the page increments the attempt', async () => {
    vi.useFakeTimers();
    const prior = { upsellIndex: 0, sessionRef: 's1-u0-1', sessionRefs: ['s1-u0-1'], status: 'pending', attempt: 1, line: { externalRef: 'v9', title: 'Up', quantity: 1, unitMinor: 500, lineMinor: 500, currency: 'USD' }, createdAt: new Date().toISOString() };
    const dto = await accept([{ ...hostedIntent({ ...hostedSnapshot, pendingUpsells: { '0': prior } }), pendingUpsellSince: new Date() }]);
    vi.useRealTimers();
    expect(dto.action).toBe('redirect');
    expect(h.createIntent.mock.calls[0][0].saleRef).toBe('s1-u0-2');
    const saved = (h.updateSnapshot.mock.calls[0] as unknown as [string, Record<string, any>])[1];
    expect(saved.pendingUpsells['0'].attempt).toBe(2);
    expect(saved.pendingUpsells['0'].sessionRefs).toEqual(['s1-u0-1', 's1-u0-2']);
    expect(h.piUpdate.mock.calls.some((c) => c[0]!.data.pendingUpsellSince instanceof Date)).toBe(true);
  });

  it('an off-site cancelTo is not stored', async () => {
    vi.useFakeTimers();
    h.intentRow = hostedIntent();
    const pending = acceptUpsell({ ...(input as object), cancelTo: 'https://evil.example/' } as never, undefined, request);
    await vi.advanceTimersByTimeAsync(6000);
    await pending;
    vi.useRealTimers();
    const saved = (h.updateSnapshot.mock.calls[0] as unknown as [string, Record<string, any>])[1];
    expect(saved.pendingUpsells['0'].cancelTo).toBeUndefined();
  });

  it('a non-redirect handle keeps the original failure', async () => {
    vi.useFakeTimers();
    h.createIntent.mockResolvedValue({ providerRef: { provider: 'ACME', providerIntentId: 'x' }, clientHandle: { provider: 'ACME', kind: 'client_secret', value: 'x' } });
    const dto = await accept();
    vi.useRealTimers();
    expect(dto.success).toBe(false);
    expect(h.updateSnapshot).not.toHaveBeenCalled();
  });

  it('Stripe without a saved card keeps the original failure', async () => {
    vi.useFakeTimers();
    h.intentRow = { ...h.intentRow!, provider: 'STRIPE' };
    const pending = acceptUpsell(input, undefined, request);
    await vi.advanceTimersByTimeAsync(6000);
    const dto = await pending;
    vi.useRealTimers();
    expect(dto).toMatchObject({ success: false, error: 'Saved payment method unavailable' });
    expect(h.createIntent).not.toHaveBeenCalled();
  });

  describe('finalizeHostedUpsell', () => {
    const entry = { upsellIndex: 0, sessionRef: 's1-u0-1', sessionRefs: ['s1-u0-1'], status: 'pending', attempt: 1, line: { externalRef: 'v9', title: 'Up', quantity: 1, unitMinor: 500, lineMinor: 500, currency: 'USD' }, nextStepUrl: '/t', createdAt: new Date().toISOString() };
    const capture = { providerChargeId: 'TR9', capturedAmountMinor: 500, currencyCode: 'USD', capturedAt: new Date().toISOString() };
    beforeEach(() => {
      h.intentRow = hostedIntent({ ...hostedSnapshot, pendingUpsells: { '0': entry } });
      h.getIntent.mockResolvedValue({ status: 'CAPTURED', capture });
    });

    it('captured: writes the CHARGE with the upsell key, appends the line, dispatches once, clears pending', async () => {
      expect(await finalizeHostedUpsell('s1', 0, undefined)).toBe('captured');
      expect(h.getIntent).toHaveBeenCalledWith('s1-u0-1', { amountMinor: 500, currencyCode: 'USD' });
      const data = (h.txnCreate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
      expect(data).toMatchObject({ idempotencyKey: 'upsell:s1:0', chargeRef: 'TR9', amountMinor: 500, provider: 'ACME', parentTransactionId: 'i1' });
      expect(h.addUpsellLine).toHaveBeenCalledOnce();
      expect(h.dispatchConversion).toHaveBeenCalledOnce();
      const written = (h.updateSnapshot.mock.calls.at(-1) as unknown as [string, Record<string, any>])[1];
      expect(written.pendingUpsells['0']).toMatchObject({ status: 'captured', nextStepUrl: '/t' });
      expect(written.returnTargets).toEqual({ next: '/n' });
    });

    it('clears the sweep marker once nothing is pending and keeps snapshot changes made during the query', async () => {
      h.intentRow = { ...hostedIntent({ ...hostedSnapshot, pendingUpsells: { '0': entry } }), pendingUpsellSince: new Date() };
      h.getIntent.mockImplementationOnce(async () => {
        h.intentRow = { ...h.intentRow!, checkoutSnapshot: { ...(h.intentRow!.checkoutSnapshot as object), lines: [{ variantExternalId: 'late' }] } };
        return { status: 'CAPTURED', capture };
      });
      await finalizeHostedUpsell('s1', 0, undefined);
      const written = (h.updateSnapshot.mock.calls.at(-1) as unknown as [string, Record<string, any>])[1];
      expect(written.lines.some((l: { variantExternalId: string }) => l.variantExternalId === 'late')).toBe(true);
      expect(h.piUpdate.mock.calls.some((c) => c[0]!.data.pendingUpsellSince === null)).toBe(true);
    });

    it('re-click then paying attempt 1 is recorded, and a second paid session is reported once', async () => {
      const two = { ...entry, sessionRef: 's1-u0-2', sessionRefs: ['s1-u0-1', 's1-u0-2'], attempt: 2 };
      h.intentRow = hostedIntent({ ...hostedSnapshot, pendingUpsells: { '0': two } });
      h.getIntent.mockImplementation(async (ref: string) => (ref === 's1-u0-1' ? { status: 'CAPTURED', capture } : { status: 'PROCESSING' }));
      expect(await finalizeHostedUpsell('s1', 0, undefined)).toBe('captured');
      expect(h.txnCreate).toHaveBeenCalledOnce();

      h.txnCreate.mockClear();
      h.priorTxn = { id: 't', chargeRef: 'TR9' };
      h.intentRow = hostedIntent({ ...hostedSnapshot, pendingUpsells: { '0': two } });
      h.getIntent.mockImplementation(async (ref: string) => ({ status: 'CAPTURED', capture: { ...capture, providerChargeId: ref === 's1-u0-1' ? 'TR9' : 'TR10' } }));
      await finalizeHostedUpsell('s1', 0, undefined);
      expect(h.txnCreate).not.toHaveBeenCalled();
      expect(h.errorLog).toHaveBeenCalledTimes(1);
      expect(h.errorLog.mock.calls[0][0]).toBe('hosted upsell paid twice; refund required');
      expect(h.errorLog.mock.calls[0][1]).toMatchObject({ saleRef: 's1', upsellIndex: 0, sessionRef: 's1-u0-2', providerChargeId: 'TR10' });
      const written = (h.updateSnapshot.mock.calls.at(-1) as unknown as [string, Record<string, any>])[1];
      expect(written.pendingUpsells['0'].duplicatePaid).toEqual(['s1-u0-2']);
    });

    it('keeps the sweep marker after capture while another session of the entry could still be paid', async () => {
      const two = { ...entry, sessionRef: 's1-u0-2', sessionRefs: ['s1-u0-1', 's1-u0-2'], attempt: 2 };
      h.intentRow = { ...hostedIntent({ ...hostedSnapshot, pendingUpsells: { '0': two } }), pendingUpsellSince: new Date() };
      h.getIntent.mockImplementation(async (ref: string) => (ref === 's1-u0-1' ? { status: 'CAPTURED', capture } : { status: 'FAILED' }));
      expect(await finalizeHostedUpsell('s1', 0, undefined)).toBe('captured');
      expect(h.piUpdate.mock.calls.some((c) => c[0]!.data.pendingUpsellSince === null)).toBe(false);
    });

    it('is idempotent: an existing CHARGE writes and dispatches nothing', async () => {
      h.priorTxn = { id: 'txn_prev', chargeRef: 'TR9' };
      expect(await finalizeHostedUpsell('s1', 0, undefined)).toBe('captured');
      expect(h.txnCreate).not.toHaveBeenCalled();
      expect(h.dispatchConversion).not.toHaveBeenCalled();
      expect(h.addUpsellLine).not.toHaveBeenCalled();
    });

    it('a lost create race (P2002) does not dispatch or append', async () => {
      h.txnCreate.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
      expect(await finalizeHostedUpsell('s1', 0, undefined)).toBe('captured');
      expect(h.dispatchConversion).not.toHaveBeenCalled();
      expect(h.addUpsellLine).not.toHaveBeenCalled();
    });

    it('failed and pending record nothing', async () => {
      h.getIntent.mockReset();
      h.getIntent.mockResolvedValue({ status: 'FAILED' });
      expect(await finalizeHostedUpsell('s1', 0, undefined)).toBe('failed');
      h.getIntent.mockResolvedValue({ status: 'PROCESSING' });
      expect(await finalizeHostedUpsell('s1', 0, undefined)).toBe('pending');
      expect(h.txnCreate).not.toHaveBeenCalled();
    });
  });
});

describe('reconcilePendingHostedUpsells query', () => {
  it('selects marked intents oldest first, limited, inside the 7 day window', async () => {
    h.findMany.mockResolvedValue([]);
    await reconcilePendingHostedUpsells();
    const arg = h.findMany.mock.calls[0][0] as { where: { pendingUpsellSince: { not: null; gt: Date } }; orderBy: unknown; take: number };
    expect(arg.where.pendingUpsellSince.not).toBeNull();
    expect(Date.now() - arg.where.pendingUpsellSince.gt.getTime()).toBeGreaterThan(6.9 * 86_400_000);
    expect(arg.orderBy).toEqual({ pendingUpsellSince: 'asc' });
    expect(arg.take).toBe(50);
  });
});
