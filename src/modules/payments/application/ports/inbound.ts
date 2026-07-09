import type { Money } from '../../../shared-kernel/money';
import type { SaleRef, CaptureMethod, RefundKind } from '../../domain/value-objects';

export interface PaymentIntentCommandPort {
  create(input: { saleRef: SaleRef; amount: Money; captureMethod: CaptureMethod; provider?: 'STRIPE' | 'PAYPAL'; checkoutSnapshot?: unknown }): Promise<{ intentId: string; clientHandle: { provider: string; kind: string; value: string } }>;
}

export interface PaymentRefundPort {
  refund(input: { intentId: string; kind: RefundKind; fixedAmount?: Money; percentage?: number; reason?: string; idempotencyKey: string }): Promise<{ refundTransactionId: string; refundedAmountMinor: number }>;
}

export interface PaymentWebhookPort {
  handle(input: { opaqueEndpointId: string; rawBody: string; headers: Record<string, string> }): Promise<{ accepted: boolean; status: string }>;
}

export interface CapturedIntentView {
  status: string;
  capturedAmountMinor: number | null;
  currencyCode: string;
  checkoutSnapshot: unknown;
}

export interface PaymentQueryPort {
  getStatus(intentId: string): Promise<{ status: string; capturedAmountMinor?: number; totalRefundedMinor?: number } | null>;
  getStatusBySaleRef(saleRef: string): Promise<{ status: string } | null>;
  getCapturedBySaleRef(saleRef: string): Promise<CapturedIntentView | null>;
}
