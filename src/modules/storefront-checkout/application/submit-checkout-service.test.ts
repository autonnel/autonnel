import { describe, it, expect, vi } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { PriceSnapshot } from '../domain/value-objects/price-snapshot';
import { OfferLineItem } from '../domain/value-objects/offer-line-item';
import { BuyerContact, Address } from '../domain/value-objects/buyer-contact';
import { ContactHandle } from '../domain/value-objects/contact-handle';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { FunnelSession } from '../domain/funnel-session';
import { CheckoutAssemblyService } from '../domain/services/checkout-assembly-service';
import { SubmitCheckoutService, CouponNotRedeemableError } from './submit-checkout-service';

const now = new Date('2026-06-04T00:00:00Z');
const hash = (n: string) => `h:${n}`;
const passingGuard = { assertRedeemable: vi.fn(async () => {}) };

function session() {
  const s = FunnelSession.start({
    sessionId: 'sess_1',
    tenantId: 'default',
    snapshotRef: FunnelSnapshotRef.of('fn_1', 1),
    stepSlugs: [StepSlug.of('checkout')],
    attribution: AttributionSnapshot.empty('sess_1'),
    entryStep: StepSlug.of('checkout'),
  });
  s.addLine(OfferLineItem.create({ variantExternalId: ExternalRef.of('gid://v/1'), title: 'x', quantity: 2, unitPrice: PriceSnapshot.create(Money.of(1000, 'USD'), now) }));
  return s;
}

const buyer = BuyerContact.create({
  fullName: 'Ada',
  handle: ContactHandle.fromEmail('ada@example.com', hash),
  address: Address.create({ line1: '1', city: 'SF', countryCode: 'US', postalCode: '94105' }),
});

describe('SubmitCheckoutService', () => {
  it('returns awaiting_capture + ClientHandle, creates the PaymentIntent with the snapshot, never persists a Sale', async () => {
    const payments = { createIntent: vi.fn(async (ref: string) => ({ clientHandle: `cs_${ref}` })) };
    const publisher = { publish: vi.fn(async (_events: unknown) => {}) };
    const svc = new SubmitCheckoutService({
      assembly: new CheckoutAssemblyService(),
      payments: payments as any,
      publisher: publisher as any,
      couponGuard: passingGuard,
      newSaleId: () => 'sale_1',
      clock: () => now,
      maxPriceAgeMs: 5 * 60_000,
    });

    const result = await svc.execute({ session: session(), buyer, coupon: null, captureMethod: 'automatic' });

    expect(result.status).toBe('awaiting_capture');
    expect(result.clientHandle).toBe('cs_sale_1');
    expect(result.saleRef).toBe('sale_1');
    expect(payments.createIntent).toHaveBeenCalledWith('sale_1', expect.objectContaining({ amountMinor: 2000 }), 'automatic', undefined, expect.objectContaining({
      sessionId: 'sess_1',
      visitorId: null,
      buyer: expect.objectContaining({ fullName: 'Ada', channel: 'email', normalized: 'ada@example.com', hashedIdentity: 'h:ada@example.com' }),
      lines: [expect.objectContaining({ variantExternalId: 'gid://v/1', quantity: 2, unitPriceMinor: 1000, currencyCode: 'USD' })],
    }));
    const events = publisher.publish.mock.calls[0]![0] as any[];
    expect(events.some((e: any) => e.type === 'CheckoutSubmitted' && e.payload.hashedIdentity === 'h:ada@example.com' && e.payload.saleRef === 'sale_1')).toBe(true);
  });

  it('applies a coupon to the captured total and re-validates it against the authoritative record', async () => {
    const { AppliedCoupon } = await import('../domain/value-objects/applied-coupon');
    const payments = { createIntent: vi.fn(async (ref: string) => ({ clientHandle: `cs_${ref}` })) };
    const publisher = { publish: vi.fn(async () => {}) };
    const couponGuard = { assertRedeemable: vi.fn(async () => {}) };
    const svc = new SubmitCheckoutService({
      assembly: new CheckoutAssemblyService(),
      payments: payments as any,
      publisher: publisher as any,
      couponGuard,
      newSaleId: () => 'sale_2',
      clock: () => now,
      maxPriceAgeMs: 5 * 60_000,
    });
    const coupon = AppliedCoupon.create('SAVE5', 'fixed', Money.of(500, 'USD'));

    await svc.execute({ session: session(), buyer, coupon, captureMethod: 'automatic' });

    // Re-checked with the PRE-coupon subtotal (2 x $10.00), not the discounted total.
    expect(couponGuard.assertRedeemable).toHaveBeenCalledWith('SAVE5', 2000, now);
    expect(payments.createIntent).toHaveBeenCalledWith('sale_2', expect.objectContaining({ amountMinor: 1500 }), 'automatic', undefined, expect.anything());
  });

  it('rejects the submit when the applied coupon is no longer redeemable (e.g. maxUsages reached), creating no PaymentIntent', async () => {
    const { AppliedCoupon } = await import('../domain/value-objects/applied-coupon');
    const payments = { createIntent: vi.fn(async (ref: string) => ({ clientHandle: `cs_${ref}` })) };
    const publisher = { publish: vi.fn(async () => {}) };
    const couponGuard = {
      assertRedeemable: vi.fn(async () => {
        throw new CouponNotRedeemableError('Coupon usage limit reached');
      }),
    };
    const svc = new SubmitCheckoutService({
      assembly: new CheckoutAssemblyService(),
      payments: payments as any,
      publisher: publisher as any,
      couponGuard,
      newSaleId: () => 'sale_3',
      clock: () => now,
      maxPriceAgeMs: 5 * 60_000,
    });
    const coupon = AppliedCoupon.create('ONCE', 'percentage', Money.of(200, 'USD'));

    await expect(svc.execute({ session: session(), buyer, coupon, captureMethod: 'automatic' })).rejects.toThrow(
      CouponNotRedeemableError,
    );
    expect(payments.createIntent).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
