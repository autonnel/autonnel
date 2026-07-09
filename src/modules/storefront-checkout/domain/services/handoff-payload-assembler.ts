import { Money } from '@/modules/shared-kernel/money';
import { IdempotencyKey } from '@/modules/shared-kernel/idempotency-key';
import type { CheckoutSnapshot } from '../../application/checkout-snapshot';

export interface HandoffLine {
  variantExternalId: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface HandoffPayload {
  saleRef: string;
  idempotencyKey: IdempotencyKey;
  grandTotal: Money;
  lines: HandoffLine[];
  appliedDiscount?: { amountMinor: number; currencyCode: string; code: string };
  customer: {
    fullName: string;
    hashedIdentity: string;
    shippingAddress: Record<string, unknown>;
  };
}

export class HandoffPayloadAssembler {
  constructor(private readonly keyFor: (tenantId: string, saleId: string) => IdempotencyKey) {}

  fromSnapshot(args: {
    tenantId: string;
    saleRef: string;
    snapshot: CheckoutSnapshot;
    capturedTotal: Money;
  }): HandoffPayload {
    const { snapshot } = args;
    const lineSubtotal = snapshot.lines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0);
    // The captured total is already net of any coupon, so the discount is the gap between the line
    // subtotal and what was charged. Carry it through so the backend order reconciles (the gateway
    // validates lineSubtotal - discount === grandTotal). Filtered split-handoffs charge the line
    // subtotal exactly, so this is 0 and no discount is emitted.
    const discountMinor = lineSubtotal - args.capturedTotal.amountMinor;
    const appliedDiscount =
      snapshot.couponCode && discountMinor > 0
        ? { amountMinor: discountMinor, currencyCode: args.capturedTotal.currencyCode, code: snapshot.couponCode }
        : undefined;
    return {
      saleRef: args.saleRef,
      idempotencyKey: this.keyFor(args.tenantId, args.saleRef),
      grandTotal: args.capturedTotal,
      lines: snapshot.lines.map((l) => ({
        variantExternalId: l.variantExternalId,
        title: l.title,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
      })),
      ...(appliedDiscount ? { appliedDiscount } : {}),
      customer: {
        fullName: snapshot.buyer.fullName,
        hashedIdentity: snapshot.buyer.hashedIdentity,
        shippingAddress: snapshot.buyer.address,
      },
    };
  }
}
