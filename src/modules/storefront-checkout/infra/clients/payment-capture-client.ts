import type { Money } from '@/modules/shared-kernel/money';
import type { CaptureMethod, PaymentCapturePort, PaymentProviderChoice } from '../../application/ports/outbound';
import type { CheckoutSnapshot } from '../../application/checkout-snapshot';

export interface PaymentIntentCommandPort {
  create(saleRef: string, amount: Money, captureMethod: CaptureMethod, provider?: PaymentProviderChoice, checkoutSnapshot?: CheckoutSnapshot): Promise<{ clientHandle: string }>;
}

export class PaymentCaptureClient implements PaymentCapturePort {
  constructor(private readonly payments: PaymentIntentCommandPort) {}

  createIntent(saleRef: string, amount: Money, captureMethod: CaptureMethod, provider?: PaymentProviderChoice, checkoutSnapshot?: CheckoutSnapshot): Promise<{ clientHandle: string }> {
    return this.payments.create(saleRef, amount, captureMethod, provider, checkoutSnapshot);
  }
}
