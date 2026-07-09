import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { PriceSnapshot } from './value-objects/price-snapshot';
import { OfferLineItem } from './value-objects/offer-line-item';
import { AppliedCoupon } from './value-objects/applied-coupon';
import { AttributionSnapshot } from './value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from './value-objects/funnel-snapshot-ref';
import { ContactHandle } from './value-objects/contact-handle';
import { BuyerContact, Address } from './value-objects/buyer-contact';
import { FunnelSession } from './funnel-session';

const ref = FunnelSnapshotRef.of('fn_1', 3);
const steps = [StepSlug.of('landing'), StepSlug.of('checkout'), StepSlug.of('upsell-1')];
const line = () =>
  OfferLineItem.create({
    variantExternalId: ExternalRef.of('gid://v/1'),
    title: 'Widget',
    quantity: 1,
    unitPrice: PriceSnapshot.create(Money.of(1000, 'USD'), new Date()),
  });

function session() {
  return FunnelSession.start({
    sessionId: 'sess_1',
    tenantId: 'default',
    snapshotRef: ref,
    stepSlugs: steps,
    attribution: AttributionSnapshot.empty('sess_1'),
    entryStep: StepSlug.of('landing'),
  });
}

describe('FunnelSession', () => {
  it('pins the snapshot ref at entry', () => {
    const s = session();
    expect(s.snapshotRef.equals(ref)).toBe(true);
    expect(s.currentStep.value).toBe('landing');
  });

  it('rejects advancing to a step not in the pinned snapshot', () => {
    const s = session();
    expect(() => s.moveTo(StepSlug.of('ghost'))).toThrow(/snapshot/i);
  });

  it('adds a cart line and recomputes the cart from snapshots', () => {
    const s = session();
    s.addLine(line());
    expect(s.cart.lines).toHaveLength(1);
  });

  it('keeps at most one coupon at a time', () => {
    const s = session();
    s.applyCoupon(AppliedCoupon.create('SAVE10', 'percentage', Money.of(100, 'USD')));
    s.applyCoupon(AppliedCoupon.create('SAVE20', 'fixed', Money.of(200, 'USD')));
    expect(s.cart.coupon?.code).toBe('SAVE20');
  });

  it('spawns at most one in_progress Sale at a time', () => {
    const s = session();
    s.linkSale('sale_1');
    expect(() => s.linkSale('sale_2')).toThrow(/one .*Sale/i);
  });

  it('captures a pre-checkout contact handle for abandonment (H2.3)', () => {
    const s = session();
    s.captureContact(ContactHandle.fromEmail('ada@example.com', (n) => `h:${n}`));
    expect(s.contactHandle?.hashedIdentity).toBe('h:ada@example.com');
  });

  it('exposes its pinned step list to the application layer', () => {
    expect(session().stepSlugs).toContain('checkout');
  });

  it('attaches the main-checkout buyer and reconstructs it for an upsell', () => {
    const s = session();
    const buyer = BuyerContact.create({
      fullName: 'Ada Lovelace',
      handle: ContactHandle.fromEmail('ada@example.com', (n) => `h:${n}`),
      address: Address.create({ line1: '1 St', city: 'London', countryCode: 'GB', postalCode: 'EC1' }),
    });
    s.attachBuyer(buyer);
    expect(s.upsellBuyerContact().handle.hashedIdentity).toBe('h:ada@example.com');
  });

  it('throws when an upsell buyer is requested before attach', () => {
    expect(() => session().upsellBuyerContact()).toThrow(/buyer/i);
  });
});
