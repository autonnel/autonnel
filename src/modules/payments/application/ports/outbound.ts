import type { PspSlug, RefundKind } from '../../domain/value-objects';
import type { Money } from '../../../shared-kernel/money';

export interface ProviderCreateIntentInput { amountMinor: number; currencyCode: string; captureMethod: 'automatic' | 'manual'; idempotencyKey: string; saleRef: string; vaultForReuse?: boolean; }
export interface ProviderCreateIntentResult { providerRef: { provider: PspSlug; providerIntentId: string }; clientHandle: { provider: PspSlug; kind: 'client_secret' | 'approval_url'; value: string }; vaultCustomerId?: string; }
export interface ProviderOffSessionChargeInput { customerId?: string; paymentMethodId: string; amountMinor: number; currencyCode: string; idempotencyKey: string; saleRef: string; }
export interface ProviderPayer { email?: string; name?: string; address?: { line1?: string; line2?: string; city?: string; region?: string; countryCode?: string; postalCode?: string } }
export interface ProviderCaptureResult { providerChargeId: string; capturedAmountMinor: number; currencyCode: string; feeMinor?: number; cardBrand?: string; cardNetwork?: string; last4?: string; capturedAt: string; payer?: ProviderPayer; }
export interface ProviderConfirmResult { status: 'CAPTURED' | 'AUTHORIZED' | 'REQUIRES_ACTION' | 'FAILED'; clientSecret?: string; capture?: ProviderCaptureResult; error?: { code?: string; message?: string }; }
export interface ProviderRefundResult { providerRefundRef: string; }
export interface ParsedWebhook { provider: PspSlug; providerEventId: string; type: string; providerIntentId?: string; providerChargeId?: string; capturedAmountMinor?: number; currencyCode?: string; cardBrand?: string; last4?: string; refundedAmountMinor?: number; }

export interface PaymentProviderPort {
  readonly slug: PspSlug;
  createIntent(input: ProviderCreateIntentInput): Promise<ProviderCreateIntentResult>;
  authorize(providerIntentId: string, idempotencyKey: string): Promise<{ providerChargeId: string; status: string }>;
  confirmIntent?(providerIntentId: string, paymentMethodId: string, returnUrl?: string): Promise<ProviderConfirmResult>;
  // One-click upsell: charge a saved payment method off-session (no buyer interaction). Stripe only.
  chargeOffSession?(input: ProviderOffSessionChargeInput): Promise<ProviderConfirmResult>;
  // PayPal merged upsell: raise the approved (uncaptured) order's total before the final capture.
  patchOrderAmount?(orderId: string, currencyCode: string, totalMinor: number): Promise<void>;
  capture(providerIntentId: string, idempotencyKey: string): Promise<ProviderCaptureResult>;
  cancel(providerIntentId: string, idempotencyKey: string): Promise<{ status: string }>;
  getIntent(providerIntentId: string): Promise<{ status: string; capture?: ProviderCaptureResult }>;
  refund(input: { providerChargeId: string; amountMinor: number; currencyCode: string; idempotencyKey: string }): Promise<ProviderRefundResult>;
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>, signingSecret: string): Promise<boolean>;
  parseWebhook(rawBody: string): ParsedWebhook;
}

import type { PaymentIntent } from '../../domain/payment-intent';
import type { RefundTransaction } from '../../domain/refund-transaction';

export interface PaymentIntentRepositoryPort {
  save(intent: PaymentIntent): Promise<void>;
  findById(id: string): Promise<PaymentIntent | null>;
  findByProviderRef(provider: PspSlug, providerIntentId: string): Promise<PaymentIntent | null>;
  findBySaleRef(saleRef: string): Promise<PaymentIntent | null>;
  findStaleProcessing(olderThan: Date, limit: number): Promise<PaymentIntent[]>;
  // Abandoned PayPal merged-upsell sessions: AUTHORIZED + captureDeferred, untouched past a cutoff.
  findDeferredOlderThan(olderThan: Date, limit: number): Promise<PaymentIntent[]>;
  // Abandoned Stripe merged-upsell sessions: CAPTURED + handoffDeferred, untouched past a cutoff.
  findHandoffDeferredOlderThan(olderThan: Date, limit: number): Promise<PaymentIntent[]>;
  updateCheckoutSnapshotBySaleRef(saleRef: string, snapshot: unknown): Promise<void>;
}

export interface ReserveRefundInput {
  parentTransactionId: string;
  // The specific charge being refunded; the prior-refund sum is scoped to it so each charge of a
  // merged-upsell intent has an independent refundable balance.
  chargeRef: string;
  idempotencyKey: string;
  // Runs inside the per-parent lock with the summed non-failed prior refunds for this charge (minor
  // units), and returns the refund to reserve. Throwing (e.g. RefundExceedsCapturedError) aborts it.
  decide: (priorRefundsMinor: number) => { id: string; kind: RefundKind; amount: Money; reason?: string };
}

export type ReserveRefundResult =
  | { status: 'reserved'; refund: RefundTransaction }
  | { status: 'duplicate'; refund: RefundTransaction };

export interface ChargeRow {
  chargeRef: string;
  amountMinor: number;
  currencyCode: string;
}

export interface TransactionRepositoryPort {
  // Atomically reserves a refund under a row lock on the parent intent: re-reads the prior-refund
  // sum for the target charge, lets `decide` size the refund against it, and persists a PENDING
  // reservation — so two concurrent refunds cannot each pass the balance check against a stale sum.
  reserveRefund(input: ReserveRefundInput): Promise<ReserveRefundResult>;
  // Marks a reserved refund acknowledged by the provider.
  settleRefund(refundId: string, providerRefundRef: string): Promise<void>;
  // Releases a reservation whose provider call failed so it no longer counts toward the balance.
  failRefund(refundId: string): Promise<void>;
  // Succeeded CHARGE rows for an intent (base + each accepted upsell), oldest first.
  listCharges(intentId: string): Promise<ChargeRow[]>;
}

export interface TenantConfigPort {
  configuredProviders(): Promise<PspSlug[]>;
  providerConfig(slug: PspSlug): Promise<Record<string, string>>;
}

export type { DomainEventPublisherPort, JobEnqueuePort } from '../../../shared-kernel/event-envelope';
