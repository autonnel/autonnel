import { Money } from '@/modules/shared-kernel/money';
import { BuyerContact } from '../value-objects/buyer-contact';
import { AppliedCoupon } from '../value-objects/applied-coupon';
import { OfferLineItem } from '../value-objects/offer-line-item';
import { FunnelSession } from '../funnel-session';
import { CartPricingService } from './cart-pricing-service';
import { PriceStalenessPolicy } from './price-staleness-policy';

export interface AssembleProps {
  session: FunnelSession;
  buyer: BuyerContact;
  coupon: AppliedCoupon | null;
  now: Date;
  maxPriceAgeMs: number;
  visitorId?: string | null;
}

export interface AssembledCheckout {
  capturedTotal: Money;
  lines: OfferLineItem[];
  buyer: BuyerContact;
}

export class CheckoutAssemblyService {
  private readonly pricing = new CartPricingService();
  private readonly staleness = new PriceStalenessPolicy();

  assemble(props: AssembleProps): AssembledCheckout {
    const lines = [...props.session.cart.lines];
    if (lines.length === 0) throw new Error('Cannot assemble a checkout from an empty cart');
    for (const line of lines) {
      this.staleness.assertFresh(line.unitPrice, props.now, props.maxPriceAgeMs);
    }
    return {
      capturedTotal: this.pricing.computeTotal(lines, props.coupon),
      lines,
      buyer: props.buyer,
    };
  }
}
