import type { CheckoutResumePort } from '../../application/ports';

export interface CheckoutResumeInbound {
  buildResumeLink(checkoutRef: string, originalParams: Record<string, string>): Promise<string>;
}

export class CheckoutResumePortClient implements CheckoutResumePort {
  constructor(private readonly inbound: CheckoutResumeInbound) {}
  async buildResumeLink(checkoutRef: string, originalParams: Record<string, string>): Promise<string> {
    return this.inbound.buildResumeLink(checkoutRef, originalParams);
  }
}
