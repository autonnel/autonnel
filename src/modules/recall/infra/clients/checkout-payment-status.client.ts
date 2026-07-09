import type { CheckoutPaymentStatusPort } from '../../application/ports';

export interface CheckoutPaymentStatusInbound {
  readPaidStatus(checkoutRef: string): Promise<{ paid: boolean; voided: boolean }>;
}

export class CheckoutPaymentStatusPortClient implements CheckoutPaymentStatusPort {
  constructor(private readonly read: CheckoutPaymentStatusInbound) {}
  async getStatus(checkoutRef: string): Promise<{ paid: boolean; voided: boolean }> {
    return this.read.readPaidStatus(checkoutRef);
  }
}
