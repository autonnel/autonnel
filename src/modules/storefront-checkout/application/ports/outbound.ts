import type { Money } from '@/modules/shared-kernel/money';
import type { IdempotencyKey } from '@/modules/shared-kernel/idempotency-key';
import type { FunnelSession } from '../../domain/funnel-session';
import type { SaleDomainEvent } from '../../domain/events';
import type { HandoffPayload } from '../../domain/services/handoff-payload-assembler';
import type { CheckoutSnapshot } from '../checkout-snapshot';

export type CaptureMethod = 'automatic' | 'manual';
export type PaymentProviderChoice = 'STRIPE' | 'PAYPAL';

export interface SerializedSession {
  raw: Record<string, unknown>;
}

export interface FunnelSessionStorePort {
  load(sessionId: string): Promise<FunnelSession | null>;
  store(session: FunnelSession, ttlSeconds: number): Promise<void>;
  signCookieValue(sessionId: string): Promise<string>;
  verifyCookieValue(value: string): Promise<string | null>;
}

export interface PaymentCapturePort {
  createIntent(
    saleRef: string,
    amount: Money,
    captureMethod: CaptureMethod,
    provider?: PaymentProviderChoice,
    checkoutSnapshot?: CheckoutSnapshot,
  ): Promise<{ clientHandle: string }>;
}

export interface PurchasableView {
  variantExternalId: string;
  title: string;
  unitPriceMinor: number;
  currencyCode: string;
  sellable: boolean;
}

export interface CommerceCatalogReaderPort {
  resolve(variantExternalIds: string[], market: { countryCode: string; currencyCode: string }): Promise<PurchasableView[]>;
}

export interface CommerceHandoffPort {
  submit(payload: HandoffPayload): Promise<{ backendRef: string }>;
}

export interface CapturedPaymentView {
  status: string;
  capturedAmountMinor: number | null;
  currencyCode: string;
  checkoutSnapshot: CheckoutSnapshot | null;
}

export interface PaymentSnapshotReaderPort {
  loadBySaleRef(saleRef: string): Promise<CapturedPaymentView | null>;
  updateCheckoutSnapshot(saleRef: string, snapshot: CheckoutSnapshot): Promise<void>;
}

export interface FunnelStepSnapshot {
  funnelId: string;
  version: number;
  stepSlugs: string[];
  pageHtmlByStep: Record<string, string>;
  entryStep: string;
}

export interface FunnelSnapshotReaderPort {
  loadByStepSlug(stepSlug: string): Promise<FunnelStepSnapshot | null>;
  loadPinned(funnelId: string, version: number): Promise<FunnelStepSnapshot | null>;
}

export interface DomainEventPublisherPort {
  publish(events: SaleDomainEvent[]): Promise<void>;
}

export interface JobQueuePort {
  enqueue(kind: string, idempotencyKey: IdempotencyKey, payload: Record<string, unknown>): Promise<void>;
}

export interface AttributionReaderPort {
  read(sessionId: string): Promise<{ landingUrl: string; clickIds: Record<string, string>; utm: Record<string, string> } | null>;
}

export interface AppConfigPort {
  getNumber(key: string, fallback: number): Promise<number>;
}

// Re-checks an already-applied coupon against the authoritative record at submit time (active,
// not expired, not over maxUsages) so a stale session snapshot can't redeem an exhausted coupon.
export interface CouponRedemptionGuardPort {
  assertRedeemable(code: string, subtotalMinor: number, now: Date): Promise<void>;
}

export interface HashIdentityPort {
  hash(normalized: string): string;
}
