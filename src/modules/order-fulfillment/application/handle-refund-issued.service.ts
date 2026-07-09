import { createLogger } from "@/lib/logger";
import { Money } from "@/modules/shared-kernel/money";
import { RefundRecordRef } from "../domain/value-objects";
import type { SaleRef } from "../domain/value-objects";
import type { OrderRepositoryPort, DomainEventPublisherPort } from "./ports";
import type { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";

const logger = createLogger("OrderFulfillment:HandleRefundIssued");

export interface RefundIssuedFact {
  saleRef: SaleRef;
  refundTransactionId: string;
  refundedAmountMinor: number;
  currencyCode: string;
}

export class HandleRefundIssuedService {
  constructor(
    private readonly repo: OrderRepositoryPort,
    private readonly publisher: DomainEventPublisherPort,
    private readonly email: EmitLifecycleEmailService,
  ) {}

  async handle(fact: RefundIssuedFact): Promise<void> {
    const order = await this.repo.findBySaleRef(fact.saleRef);
    if (!order) {
      logger.warn("RefundIssued for unknown SaleRef; recorded no-op", { saleRef: fact.saleRef });
      return;
    }
    const changed = order.recordRefund(
      RefundRecordRef.of({
        transactionId: fact.refundTransactionId,
        amount: Money.of(fact.refundedAmountMinor, fact.currencyCode),
      }),
    );
    // Persist even when state unchanged so the refund record itself is durable.
    await this.repo.save(order);
    if (!changed) return;
    await this.publisher.publishAll(order.pullEvents());
    await this.email.emit(order, "order.refunded");
  }
}
