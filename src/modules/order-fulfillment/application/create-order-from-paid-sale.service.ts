import { createLogger } from "@/lib/logger";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../domain/order";
import {
  OfferLineSnapshot,
  CustomerSnapshot,
  ContactSnapshot,
  BackendOrderRef,
} from "../domain/value-objects";
import type { AddressSnapshot, AttributionSnapshot, SaleRef } from "../domain/value-objects";
import { generateOrderNumber } from "../domain/services/order-number-generator";
import type { OrderRepositoryPort, DomainEventPublisherPort } from "./ports";
import type { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";

const logger = createLogger("OrderFulfillment:CreateOrderFromPaidSale");

export interface PaymentCapturedFact {
  saleRef: SaleRef;
  capturedTotalMinor: number;
  currencyCode: string;
  captureIdempotencyKey: string;
  // Optional: the order number is autonnel-owned and generated here when not supplied.
  orderNumber?: string;
  lines: Array<{
    externalRef: string;
    title: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
  customer: { email: string; name?: string; phone?: string };
  contact?: {
    channel?: string;
    normalized?: string;
    hashedIdentity?: string;
    address?: AddressSnapshot;
  };
  backendOrderRef?: string;
  attribution?: AttributionSnapshot;
  checkoutLanguage?: string | null;
}

export type OrderIdFactory = () => string;

export class CreateOrderFromPaidSaleService {
  constructor(
    private readonly repo: OrderRepositoryPort,
    private readonly publisher: DomainEventPublisherPort,
    private readonly email: EmitLifecycleEmailService,
    private readonly newId: OrderIdFactory,
  ) {}

  // Returns true only when a new Order was created, so callers can run exactly-once side
  // effects (e.g. coupon redemption) without double-firing on event redelivery.
  async handle(fact: PaymentCapturedFact): Promise<boolean> {
    // Idempotent: exactly one Order per SaleRef.
    const existing = await this.repo.findBySaleRef(fact.saleRef);
    if (existing) {
      logger.info("Order already exists for SaleRef; skipping", { saleRef: fact.saleRef });
      return false;
    }

    const currency = fact.currencyCode;
    const order = Order.createFromPaidSale({
      id: this.newId(),
      orderNumber: fact.orderNumber ?? generateOrderNumber(),
      saleRef: fact.saleRef,
      capturedTotal: Money.of(fact.capturedTotalMinor, currency),
      lines: fact.lines.map((l) =>
        OfferLineSnapshot.of({
          externalRef: l.externalRef,
          title: l.title,
          quantity: l.quantity,
          unitPrice: Money.of(l.unitPriceMinor, currency),
          lineTotal: Money.of(l.lineTotalMinor, currency),
        }),
      ),
      customer: CustomerSnapshot.of(fact.customer),
      contact: fact.contact ? ContactSnapshot.of(fact.contact) : undefined,
      backendOrderRef: fact.backendOrderRef ? BackendOrderRef.of(fact.backendOrderRef) : undefined,
      attribution: fact.attribution,
      checkoutLanguage: fact.checkoutLanguage ?? null,
    });

    const events = order.pullEvents();
    await this.repo.save(order);
    await this.publisher.publishAll(events);
    await this.email.emit(order, "order.receipt");
    return true;
  }
}
