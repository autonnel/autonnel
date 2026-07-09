import { Money } from "@/modules/shared-kernel/money";

// SaleRef is the published-language correlation key from Storefront/Payments.
export type SaleRef = string;

export interface OfferLineSnapshotProps {
  externalRef: string; // opaque ExternalRef; never parsed by this context
  title: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export class OfferLineSnapshot {
  private constructor(
    readonly externalRef: string,
    readonly title: string,
    readonly quantity: number,
    readonly unitPrice: Money,
    readonly lineTotal: Money,
  ) {
    Object.freeze(this);
  }
  static of(p: OfferLineSnapshotProps): OfferLineSnapshot {
    return new OfferLineSnapshot(p.externalRef, p.title, p.quantity, p.unitPrice, p.lineTotal);
  }
}

export class RefundRecordRef {
  private constructor(readonly transactionId: string, readonly amount: Money) {
    Object.freeze(this);
  }
  static of(p: { transactionId: string; amount: Money }): RefundRecordRef {
    return new RefundRecordRef(p.transactionId, p.amount);
  }
}

export class BackendOrderRef {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }
  static of(value: string): BackendOrderRef {
    return new BackendOrderRef(value);
  }
}

export class CustomerSnapshot {
  private constructor(
    readonly email: string,
    readonly name: string | undefined,
    readonly phone: string | undefined,
  ) {
    Object.freeze(this);
  }
  static of(p: { email: string; name?: string; phone?: string }): CustomerSnapshot {
    return new CustomerSnapshot(p.email, p.name, p.phone);
  }
}

export interface AddressSnapshot {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  countryCode: string;
  postalCode: string;
}

// Buyer contact snapshot carried alongside the customer so recall can reach the buyer
// without reading the upstream Sale.
export class ContactSnapshot {
  private constructor(
    readonly channel: string | undefined,
    readonly normalized: string | undefined,
    readonly hashedIdentity: string | undefined,
    readonly address: AddressSnapshot | undefined,
  ) {
    Object.freeze(this);
  }
  static of(p: {
    channel?: string;
    normalized?: string;
    hashedIdentity?: string;
    address?: AddressSnapshot;
  }): ContactSnapshot {
    return new ContactSnapshot(p.channel, p.normalized, p.hashedIdentity, p.address);
  }
}

export interface AttributionSnapshot {
  firstSeenUrl?: string;
  sessionId?: string;
  visitorId?: string;
}
