import type { PaymentSnapshotReaderPort } from './ports/outbound';
import type { CheckoutPaymentStatusPort } from './ports/inbound';

export class CheckoutPaymentStatusService implements CheckoutPaymentStatusPort {
  constructor(private readonly paymentSnapshots: PaymentSnapshotReaderPort) {}

  async isPaid(saleRef: string): Promise<boolean> {
    const view = await this.paymentSnapshots.loadBySaleRef(saleRef);
    return view?.status === 'CAPTURED';
  }
}
