import { BuyerContact } from '../domain/value-objects/buyer-contact';
import { AppliedCoupon } from '../domain/value-objects/applied-coupon';
import { FunnelSession } from '../domain/funnel-session';
import { CheckoutAssemblyService } from '../domain/services/checkout-assembly-service';
import { CartPricingService } from '../domain/services/cart-pricing-service';
import { saleEvents } from '../domain/events';
import type { CaptureMethod, CouponRedemptionGuardPort, DomainEventPublisherPort, PaymentCapturePort, PaymentProviderChoice } from './ports/outbound';
import type { SubmitCheckoutResult } from './ports/inbound';
import { buildCheckoutSnapshot } from './checkout-snapshot';

export class CouponNotRedeemableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CouponNotRedeemableError';
  }
}

export interface SubmitCheckoutDeps {
  assembly: CheckoutAssemblyService;
  payments: PaymentCapturePort;
  publisher: DomainEventPublisherPort;
  couponGuard: CouponRedemptionGuardPort;
  newSaleId: () => string;
  clock: () => Date;
  maxPriceAgeMs: number;
}

export interface SubmitCheckoutInput {
  session: FunnelSession;
  buyer: BuyerContact;
  coupon: AppliedCoupon | null;
  captureMethod: CaptureMethod;
  visitorId?: string | null;
  provider?: PaymentProviderChoice;
  locale?: string | null;
}

export class SubmitCheckoutService {
  private readonly pricing = new CartPricingService();

  constructor(private readonly deps: SubmitCheckoutDeps) {}

  async execute(input: SubmitCheckoutInput): Promise<SubmitCheckoutResult> {
    input.session.attachBuyer(input.buyer);
    const now = this.deps.clock();
    const { capturedTotal, lines, buyer } = this.deps.assembly.assemble({
      session: input.session,
      buyer: input.buyer,
      coupon: input.coupon,
      now,
      maxPriceAgeMs: this.deps.maxPriceAgeMs,
      visitorId: input.visitorId ?? null,
    });

    if (input.coupon) {
      const subtotal = this.pricing.computeTotal(lines, null);
      await this.deps.couponGuard.assertRedeemable(input.coupon.code, subtotal.amountMinor, now);
    }

    const saleRef = this.deps.newSaleId();
    input.session.linkSale(saleRef);

    const snapshot = buildCheckoutSnapshot({ lines, buyer, sessionId: input.session.sessionId, visitorId: input.visitorId ?? null, funnelId: input.session.snapshotRef.funnelId, couponCode: input.coupon?.code ?? null, locale: input.locale ?? null });
    const { clientHandle } = await this.deps.payments.createIntent(
      saleRef,
      capturedTotal,
      input.captureMethod,
      input.provider,
      snapshot,
    );

    await this.deps.publisher.publish([
      saleEvents.checkoutSubmitted({
        saleRef,
        sessionId: input.session.sessionId,
        hashedIdentity: buyer.handle.hashedIdentity,
      }),
    ]);

    return { saleRef, clientHandle, status: 'awaiting_capture' };
  }
}
