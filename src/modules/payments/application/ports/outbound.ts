import type { PspSlug, RefundKind } from '../../domain/value-objects';
import type { ClientHandleKind } from '../../domain/value-objects';
import type { Money } from '../../../shared-kernel/money';

export interface PaymentRequestAddress { line1?: string; line2?: string; city?: string; region?: string; countryCode?: string; postalCode?: string }
export interface PaymentRequestLine { sku: string; title: string; quantity: number; unitPriceMinor: number; currencyCode: string }
// Buyer, cart and request facts for providers that need them up front (hosted pages, MIT charges).
export interface PaymentRequestContext {
  buyer: { email?: string; phone?: string; fullName?: string; shopperId?: string; address?: PaymentRequestAddress };
  lines: PaymentRequestLine[];
  sessionId?: string;
  returnUrl?: string;
  notifyUrl?: string;
  clientIp?: string;
  userAgent?: string;
  locale?: string | null;
}

export interface ProviderCreateIntentInput { amountMinor: number; currencyCode: string; captureMethod: 'automatic' | 'manual'; idempotencyKey: string; saleRef: string; vaultForReuse?: boolean; context?: PaymentRequestContext; }
export interface ProviderCreateIntentResult { providerRef: { provider: PspSlug; providerIntentId: string }; clientHandle: { provider: PspSlug; kind: ClientHandleKind; value: string }; vaultCustomerId?: string; }
export interface ProviderOffSessionChargeInput { customerId?: string; paymentMethodId: string; amountMinor: number; currencyCode: string; idempotencyKey: string; saleRef: string; context?: PaymentRequestContext; }
export interface ProviderPayer { email?: string; name?: string; address?: { line1?: string; line2?: string; city?: string; region?: string; countryCode?: string; postalCode?: string } }
export interface ProviderCaptureResult { providerChargeId: string; capturedAmountMinor: number; currencyCode: string; feeMinor?: number; cardBrand?: string; cardNetwork?: string; last4?: string; capturedAt: string; payer?: ProviderPayer; vaultRef?: string; }
export interface ProviderConfirmResult { status: 'CAPTURED' | 'AUTHORIZED' | 'REQUIRES_ACTION' | 'FAILED'; clientSecret?: string; capture?: ProviderCaptureResult; error?: { code?: string; message?: string }; }
export interface ProviderRefundResult { providerRefundRef: string; }
export interface ParsedWebhook {
  provider: PspSlug; providerEventId: string; type: string; providerIntentId?: string; providerChargeId?: string;
  capturedAmountMinor?: number; currencyCode?: string; cardBrand?: string; last4?: string; refundedAmountMinor?: number;
  // Redirect-style providers: the payment outcome carried by the notification.
  status?: 'CAPTURED' | 'FAILED' | 'PENDING';
  capture?: ProviderCaptureResult;
  vaultRef?: string;
}
export interface IntentAmountHint { amountMinor: number; currencyCode: string }
export interface WebhookAck { status: number; body: string; contentType?: string }

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
  // `hint` lets providers whose status query omits the amount report the intent's own amount.
  getIntent(providerIntentId: string, hint?: IntentAmountHint): Promise<{ status: string; capture?: ProviderCaptureResult }>;
  // Response body the provider expects after a verified notification; defaults to 200 "OK".
  webhookAck?(): WebhookAck;
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
  // Atomically moves REQUIRES_PAYMENT / PROCESSING to CAPTURED; true only for the single winner.
  claimCapture(intentId: string): Promise<boolean>;
  // Undo a claim whose charge details were never persisted so the reconcile cron can retry.
  releaseCapture(intentId: string): Promise<void>;
  setVaultRef(intentId: string, vaultRef: string): Promise<void>;
  // PROCESSING intents untouched since `olderThan` become CANCELED; returns how many.
  cancelStaleProcessing(olderThan: Date): Promise<number>;
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
