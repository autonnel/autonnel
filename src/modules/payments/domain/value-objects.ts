import { Money } from '../../shared-kernel/money';

export type PspSlug = 'STRIPE' | 'PAYPAL';

export class SaleRef {
  private constructor(public readonly value: string) {}
  static of(value: string): SaleRef {
    if (!value) throw new Error('SaleRef requires a non-empty value');
    return new SaleRef(value);
  }
}

export class ProviderRef {
  private constructor(
    public readonly provider: PspSlug,
    public readonly providerIntentId: string,
  ) {}
  static of(provider: PspSlug, providerIntentId: string): ProviderRef {
    if (!providerIntentId) throw new Error('ProviderRef requires a providerIntentId');
    return new ProviderRef(provider, providerIntentId);
  }
}

export const CaptureMethod = { AUTOMATIC: 'automatic', MANUAL: 'manual' } as const;
export type CaptureMethod = (typeof CaptureMethod)[keyof typeof CaptureMethod];

export interface CaptureResultProps {
  providerChargeId: string;
  capturedAmount: Money;
  fee?: Money;
  cardBrand?: string;
  cardNetwork?: string;
  last4?: string;
  capturedAt: Date;
  payer?: { email?: string; name?: string; address?: { line1?: string; line2?: string; city?: string; region?: string; countryCode?: string; postalCode?: string } };
}

export class CaptureResult {
  private constructor(private readonly props: CaptureResultProps) {}
  static of(props: CaptureResultProps): CaptureResult {
    if (!props.providerChargeId) throw new Error('CaptureResult requires providerChargeId');
    return new CaptureResult(props);
  }
  get providerChargeId() { return this.props.providerChargeId; }
  get capturedAmount() { return this.props.capturedAmount; }
  get fee() { return this.props.fee; }
  get cardBrand() { return this.props.cardBrand; }
  get last4() { return this.props.last4; }
  get capturedAt() { return this.props.capturedAt; }
  get payer() { return this.props.payer; }
}

// Short-lived browser handle for SCA / redirect (Stripe client_secret / PayPal approval url).
export class ClientHandle {
  private constructor(
    public readonly provider: PspSlug,
    public readonly kind: 'client_secret' | 'approval_url',
    public readonly value: string,
  ) {}
  static stripeClientSecret(value: string): ClientHandle {
    return new ClientHandle('STRIPE', 'client_secret', value);
  }
  static paypalApprovalUrl(value: string): ClientHandle {
    return new ClientHandle('PAYPAL', 'approval_url', value);
  }
}

export const RefundKind = { FULL: 'full', FIXED: 'fixed', PERCENTAGE: 'percentage' } as const;
export type RefundKind = (typeof RefundKind)[keyof typeof RefundKind];

const NON_RETRYABLE = new Set(['card_declined', 'expired_card', 'incorrect_cvc', 'do_not_honor']);

export class PaymentError {
  private constructor(
    public readonly code: string,
    public readonly declineCode: string | undefined,
    public readonly retryable: boolean,
  ) {}
  static fromDecline(code: string, declineCode?: string): PaymentError {
    return new PaymentError(code, declineCode, !NON_RETRYABLE.has(code));
  }
}
