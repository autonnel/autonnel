// Checkout-time snapshot carried onto the PaymentIntent so the handoff/order
// contexts can source lines + buyer downstream. Plain JSON only.
import type { OfferLineItem } from '../domain/value-objects/offer-line-item';
import type { BuyerContact } from '../domain/value-objects/buyer-contact';

export interface CheckoutSnapshotLine {
  variantExternalId: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  currencyCode: string;
  capturedAt: string;
  // Set on lines appended by the upsell flow; absent on the base checkout lines. Used to split base
  // vs upsell lines when fulfillmentMode is "split".
  upsellIndex?: number;
}

export interface CheckoutSnapshotBuyer {
  fullName: string;
  address: Record<string, unknown>;
  channel: 'email' | 'phone';
  normalized: string;
  hashedIdentity: string;
}

export interface CheckoutSnapshot {
  lines: CheckoutSnapshotLine[];
  buyer: CheckoutSnapshotBuyer;
  sessionId: string;
  visitorId: string | null;
  // The funnel this sale belongs to, captured at checkout so post-payment conversion postbacks
  // resolve attribution without any separate analytics-session lookup.
  funnelId: string | null;
  couponCode?: string | null;
  locale: string | null;
}

export interface BuildCheckoutSnapshotInput {
  lines: readonly OfferLineItem[];
  buyer: BuyerContact;
  sessionId: string;
  visitorId?: string | null;
  funnelId?: string | null;
  couponCode?: string | null;
  locale?: string | null;
}

export function buildCheckoutSnapshot(input: BuildCheckoutSnapshotInput): CheckoutSnapshot {
  return {
    sessionId: input.sessionId,
    visitorId: input.visitorId ?? null,
    funnelId: input.funnelId ?? null,
    couponCode: input.couponCode ?? null,
    locale: input.locale ?? null,
    buyer: {
      fullName: input.buyer.fullName,
      address: input.buyer.address.toJSON() as unknown as Record<string, unknown>,
      channel: input.buyer.handle.channel,
      normalized: input.buyer.handle.normalized,
      hashedIdentity: input.buyer.handle.hashedIdentity,
    },
    lines: input.lines.map((l) => ({
      variantExternalId: l.variantExternalId.toString(),
      title: l.title,
      quantity: l.quantity,
      unitPriceMinor: l.unitPrice.amount.amountMinor,
      currencyCode: l.unitPrice.amount.currencyCode,
      capturedAt: l.unitPrice.capturedAt.toISOString(),
    })),
  };
}
