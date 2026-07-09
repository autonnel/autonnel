import { CartPricingService } from '../domain/services/cart-pricing-service';
import { CouponEvaluationService, type CouponDefinition } from '../domain/services/coupon-evaluation-service';
import type { FunnelSessionStorePort } from './ports/outbound';

export interface CouponDefinitionReader {
  findByCode(code: string): Promise<CouponDefinition | null>;
}

export interface ApplyCouponDeps {
  sessions: FunnelSessionStorePort;
  coupons: CouponDefinitionReader;
  ttlSeconds: number;
}

export class ApplyCouponService {
  private readonly pricing = new CartPricingService();
  private readonly evaluation = new CouponEvaluationService();

  constructor(private readonly deps: ApplyCouponDeps) {}

  async execute(sessionId: string, code: string): Promise<{ discountMinor: number }> {
    const session = await this.deps.sessions.load(sessionId);
    if (!session) throw new Error('FunnelSession not found');
    const def = await this.deps.coupons.findByCode(code);
    if (!def) throw new Error('Unknown coupon code');
    const subtotal = this.pricing.computeTotal([...session.cart.lines], null);
    const applied = this.evaluation.evaluate(def, subtotal);
    session.applyCoupon(applied);
    await this.deps.sessions.store(session, this.deps.ttlSeconds);
    return { discountMinor: applied.discount.amountMinor };
  }
}
