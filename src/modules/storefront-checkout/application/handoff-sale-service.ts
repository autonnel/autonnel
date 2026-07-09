import { Money } from '@/modules/shared-kernel/money';
import { HandoffPayloadAssembler } from '../domain/services/handoff-payload-assembler';
import { saleEvents } from '../domain/events';
import { createLogger } from '@/lib/logger';
import type { CheckoutSnapshotLine } from './checkout-snapshot';
import type { CommerceHandoffPort, DomainEventPublisherPort, PaymentSnapshotReaderPort } from './ports/outbound';

export interface HandoffSaleDeps {
  paymentSnapshots: PaymentSnapshotReaderPort;
  handoff: CommerceHandoffPort;
  publisher: DomainEventPublisherPort;
  assembler: HandoffPayloadAssembler;
  tenantId: string;
}

const logger = createLogger('HandoffSale');

export class HandoffSaleService {
  constructor(private readonly deps: HandoffSaleDeps) {}

  // lineFilter restricts which snapshot lines are pushed (split fulfillment uses it to send a
  // base-only main order, with upsells pushed separately). When filtering, the grand total is
  // recomputed from the kept lines so the backend's captured==total invariant still holds.
  async execute(saleRef: string, lineFilter?: (line: CheckoutSnapshotLine) => boolean): Promise<void> {
    const view = await this.deps.paymentSnapshots.loadBySaleRef(saleRef);
    if (!view || view.status !== 'CAPTURED' || !view.checkoutSnapshot) {
      logger.warn('handoff skipped: no captured PaymentIntent snapshot', { saleRef, status: view?.status });
      return;
    }
    const lines = lineFilter ? view.checkoutSnapshot.lines.filter(lineFilter) : view.checkoutSnapshot.lines;
    if (lines.length === 0) {
      logger.info('handoff skipped: no lines after filter', { saleRef });
      return;
    }
    const capturedTotal = lineFilter
      ? Money.of(lines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0), view.currencyCode)
      : Money.of(view.capturedAmountMinor ?? 0, view.currencyCode);
    const payload = this.deps.assembler.fromSnapshot({
      tenantId: this.deps.tenantId,
      saleRef,
      snapshot: lineFilter ? { ...view.checkoutSnapshot, lines } : view.checkoutSnapshot,
      capturedTotal,
    });
    try {
      const { backendRef } = await this.deps.handoff.submit(payload);
      await this.deps.publisher.publish([
        saleEvents.saleHandedOff({ saleRef, backendRef, snapshot: view.checkoutSnapshot }),
      ]);
    } catch (err) {
      await this.deps.publisher.publish([saleEvents.saleHandoffFailed({ saleRef })]);
      throw err; // let the Job queue retry per its RetryPolicy
    }
  }
}
