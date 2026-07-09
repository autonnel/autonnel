import { describe, it, expect, vi } from 'vitest';
import { IdempotencyKey } from '@/modules/shared-kernel/idempotency-key';
import { HandoffPayloadAssembler } from '../domain/services/handoff-payload-assembler';
import { HandoffSaleService } from './handoff-sale-service';
import type { CheckoutSnapshot } from './checkout-snapshot';
import type { CapturedPaymentView } from './ports/outbound';

function snapshot(): CheckoutSnapshot {
  return {
    sessionId: 'sess_1',
    visitorId: null,
    funnelId: null,
    locale: null,
    buyer: {
      fullName: 'Ada',
      address: { line1: '1', city: 'SF', countryCode: 'US', postalCode: '94105' },
      channel: 'email',
      normalized: 'ada@example.com',
      hashedIdentity: 'h:ada@example.com',
    },
    lines: [{ variantExternalId: 'gid://v/1', title: 'x', quantity: 2, unitPriceMinor: 1000, currencyCode: 'USD', capturedAt: new Date().toISOString() }],
  };
}

function capturedView(): CapturedPaymentView {
  return { status: 'CAPTURED', capturedAmountMinor: 2000, currencyCode: 'USD', checkoutSnapshot: snapshot() };
}

function makeDeps(view: CapturedPaymentView | null, submit: () => Promise<{ backendRef: string }>) {
  const published: any[] = [];
  return {
    published,
    deps: {
      paymentSnapshots: { loadBySaleRef: vi.fn(async () => view) },
      handoff: { submit: vi.fn(submit) },
      publisher: { publish: vi.fn(async (e: any[]) => { published.push(...e); }) },
      assembler: new HandoffPayloadAssembler((t, s) => IdempotencyKey.of(`${t}:${s}`)),
      tenantId: 'default',
    },
  };
}

describe('HandoffSaleService', () => {
  it('submits the handoff from the PaymentIntent snapshot and publishes SaleHandedOff with the snapshot', async () => {
    const { published, deps } = makeDeps(capturedView(), async () => ({ backendRef: 'ext_1' }));
    const svc = new HandoffSaleService(deps as any);
    await svc.execute('sale_1');
    const handed = published.find((e) => e.type === 'SaleHandedOff');
    expect(handed.payload.backendRef).toBe('ext_1');
    expect(handed.payload.saleRef).toBe('sale_1');
    expect(handed.payload.snapshot.buyer.fullName).toBe('Ada');
  });

  it('publishes SaleHandoffFailed when the backend submit throws', async () => {
    const { published, deps } = makeDeps(capturedView(), async () => { throw new Error('backend down'); });
    const svc = new HandoffSaleService(deps as any);
    await expect(svc.execute('sale_1')).rejects.toThrow(/backend down/);
    expect(published.some((e) => e.type === 'SaleHandoffFailed')).toBe(true);
  });

  it('with a base-only line filter, submits only base lines and recomputes the grand total', async () => {
    const view: CapturedPaymentView = {
      status: 'CAPTURED',
      capturedAmountMinor: 3500,
      currencyCode: 'USD',
      checkoutSnapshot: {
        ...snapshot(),
        lines: [
          { variantExternalId: 'gid://v/base', title: 'Base', quantity: 1, unitPriceMinor: 2000, currencyCode: 'USD', capturedAt: 'now' },
          { variantExternalId: 'gid://v/up', title: 'Upsell', quantity: 1, unitPriceMinor: 1500, currencyCode: 'USD', capturedAt: 'now', upsellIndex: 0 },
        ],
      },
    };
    const { deps } = makeDeps(view, async () => ({ backendRef: 'ext_base' }));
    const svc = new HandoffSaleService(deps as any);
    await svc.execute('sale_1', (l) => l.upsellIndex === undefined);
    const payload = (deps.handoff.submit as any).mock.calls[0][0];
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0].variantExternalId).toBe('gid://v/base');
    // grand total recomputed from base only (2000), NOT the sale-wide captured total (3500).
    expect(payload.grandTotal.amountMinor).toBe(2000);
  });

  it('skips when the PaymentIntent is not captured', async () => {
    const { published, deps } = makeDeps({ status: 'PROCESSING', capturedAmountMinor: null, currencyCode: 'USD', checkoutSnapshot: null }, async () => ({ backendRef: 'x' }));
    const svc = new HandoffSaleService(deps as any);
    await svc.execute('sale_1');
    expect(deps.handoff.submit).not.toHaveBeenCalled();
    expect(published).toHaveLength(0);
  });
});
