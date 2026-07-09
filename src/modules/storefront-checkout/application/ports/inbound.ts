import type { CaptureMethod } from './outbound';

export interface RenderStepResult {
  html: string;
  funnelId: string;
  version: number;
  currentStep: string;
}

export interface FunnelHttpPort {
  renderStep(stepSlug: string, sessionCookie: string | null): Promise<RenderStepResult>;
}

export interface SubmitCheckoutResult {
  saleRef: string;
  clientHandle: string;
  status: 'awaiting_capture';
}

export interface CheckoutActionPort {
  addToCart(sessionCookie: string | null, input: { variantExternalId: string; quantity: number }): Promise<{ sessionCookie: string }>;
  applyCoupon(sessionCookie: string, code: string): Promise<{ discountMinor: number }>;
  submitCheckout(sessionCookie: string, input: { buyer: unknown; captureMethod: CaptureMethod }): Promise<SubmitCheckoutResult>;
  advanceStep(sessionCookie: string, outcome: 'accepted' | 'declined' | 'completed'): Promise<{ nextStep: string }>;
}

export interface OneClickUpsellInboundPort {
  acceptUpsell(sessionCookie: string, input: { variantExternalId: string; quantity: number }): Promise<{ saleRef: string; clientHandle: string }>;
}

export interface AdminHandoffRetryPort {
  retry(saleRef: string): Promise<{ status: string }>;
}

// Authoritative paid/voided read surface other contexts (Recall) call synchronously.
export interface CheckoutPaymentStatusPort {
  isPaid(saleRef: string): Promise<boolean>;
}
