import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { FunnelSession } from '../domain/funnel-session';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { ContactHandle } from '../domain/value-objects/contact-handle';
import { BuyerContact, Address, type AddressProps } from '../domain/value-objects/buyer-contact';
import { OfferLineItem } from '../domain/value-objects/offer-line-item';
import { PriceSnapshot } from '../domain/value-objects/price-snapshot';
import { AppliedCoupon, type CouponKind } from '../domain/value-objects/applied-coupon';

export interface SerializedCartLine {
  variantExternalId: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  currencyCode: string;
  capturedAt: string;
}

export interface SerializedCoupon {
  code: string;
  kind: CouponKind;
  discountMinor: number;
  currencyCode: string;
}

export interface SerializedSession {
  sessionId: string;
  tenantId: string;
  funnelId: string;
  version: number;
  stepSlugs: string[];
  currentStep: string;
  attribution: ReturnType<AttributionSnapshot['toJSON']>;
  contact: { channel: 'email' | 'phone'; normalized: string; hashedIdentity: string } | null;
  // Buyer is frozen at main-checkout submit and reused for one-click upsell; it must
  // survive the session KV round-trip or the upsell loses its captured buyer.
  buyer: { fullName: string; contact: { channel: 'email' | 'phone'; normalized: string; hashedIdentity: string }; address: AddressProps } | null;
  linkedSaleId: string | null;
  cartLines: SerializedCartLine[];
  coupon: SerializedCoupon | null;
}

export function serializeSession(session: FunnelSession): SerializedSession {
  return {
    sessionId: session.sessionId,
    tenantId: session.tenantId,
    funnelId: session.snapshotRef.funnelId,
    version: session.snapshotRef.version,
    stepSlugs: session.stepSlugs,
    currentStep: session.currentStep.value,
    attribution: session.attribution.toJSON(),
    contact: session.contactHandle
      ? { channel: session.contactHandle.channel, normalized: session.contactHandle.normalized, hashedIdentity: session.contactHandle.hashedIdentity }
      : null,
    buyer: session.buyer
      ? {
          fullName: session.buyer.fullName,
          contact: { channel: session.buyer.handle.channel, normalized: session.buyer.handle.normalized, hashedIdentity: session.buyer.handle.hashedIdentity },
          address: session.buyer.address.toJSON(),
        }
      : null,
    linkedSaleId: session.linkedSaleId,
    cartLines: session.cart.lines.map((l) => ({
      variantExternalId: l.variantExternalId.toString(),
      title: l.title,
      quantity: l.quantity,
      unitPriceMinor: l.unitPrice.amount.amountMinor,
      currencyCode: l.unitPrice.amount.currencyCode,
      capturedAt: l.unitPrice.capturedAt.toISOString(),
    })),
    coupon: session.cart.coupon
      ? {
          code: session.cart.coupon.code,
          kind: session.cart.coupon.kind,
          discountMinor: session.cart.coupon.discount.amountMinor,
          currencyCode: session.cart.coupon.discount.currencyCode,
        }
      : null,
  };
}

export function deserializeSession(raw: SerializedSession): FunnelSession {
  const session = FunnelSession.start({
    sessionId: raw.sessionId,
    tenantId: raw.tenantId,
    snapshotRef: FunnelSnapshotRef.of(raw.funnelId, raw.version),
    stepSlugs: raw.stepSlugs.map((s) => StepSlug.of(s)),
    attribution: AttributionSnapshot.create(raw.attribution),
    entryStep: StepSlug.of(raw.currentStep),
  });
  if (raw.contact) {
    session.captureContact(ContactHandle.rehydrate(raw.contact.channel, raw.contact.normalized, raw.contact.hashedIdentity));
  }
  if (raw.buyer) {
    session.attachBuyer(
      BuyerContact.create({
        fullName: raw.buyer.fullName,
        handle: ContactHandle.rehydrate(raw.buyer.contact.channel, raw.buyer.contact.normalized, raw.buyer.contact.hashedIdentity),
        address: Address.create(raw.buyer.address),
      }),
    );
  }
  for (const l of raw.cartLines) {
    session.addLine(
      OfferLineItem.create({
        variantExternalId: ExternalRef.of(l.variantExternalId),
        title: l.title,
        quantity: l.quantity,
        unitPrice: PriceSnapshot.create(Money.of(l.unitPriceMinor, l.currencyCode), new Date(l.capturedAt)),
      }),
    );
  }
  if (raw.coupon) {
    session.applyCoupon(AppliedCoupon.create(raw.coupon.code, raw.coupon.kind, Money.of(raw.coupon.discountMinor, raw.coupon.currencyCode)));
  }
  if (raw.linkedSaleId) session.linkSale(raw.linkedSaleId);
  return session;
}
