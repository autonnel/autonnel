import pLimit from "p-limit";
import { createLogger } from "@/lib/logger";
import type { Order } from "../domain/order";
import { OrderLifecycleState } from "../domain/order-lifecycle-state";
import { TrackingInfo } from "../domain/tracking-info";
import type {
  OrderRepositoryPort,
  BackendFulfillmentReaderPort,
  DomainEventPublisherPort,
  FulfillmentCronPort,
  OrderCursor,
} from "./ports";
import type { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";

const logger = createLogger("OrderFulfillment:SyncFulfillmentStatus");
const PAGE_SIZE = 100;
const MAX_PER_SWEEP = 500;
const CONCURRENCY = 6;

function emptyTracking(): TrackingInfo {
  return TrackingInfo.of({});
}

export class SyncFulfillmentStatusService implements FulfillmentCronPort {
  constructor(
    private readonly repo: OrderRepositoryPort,
    private readonly reader: BackendFulfillmentReaderPort,
    private readonly publisher: DomainEventPublisherPort,
    private readonly email: EmitLifecycleEmailService,
  ) {}

  async sweep(): Promise<{ scanned: number; advanced: number }> {
    const limit = pLimit(CONCURRENCY);
    let cursor: OrderCursor | undefined;
    let scanned = 0;
    let advanced = 0;

    while (scanned < MAX_PER_SWEEP) {
      const page = await this.repo.findPaidWithBackendRef(PAGE_SIZE, cursor);
      if (page.orders.length === 0) break;
      scanned += page.orders.length;

      const results = await Promise.all(
        page.orders.map((order) =>
          limit(async () => {
            try {
              return await this.pollOne(order);
            } catch (err) {
              // Backend read failures are transient; leave the order untouched for the next sweep.
              logger.warn("Fulfillment poll failed for order", { orderId: order.id, error: err });
              return false;
            }
          }),
        ),
      );
      advanced += results.filter(Boolean).length;

      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return { scanned, advanced };
  }

  private async pollOne(batchOrder: Order): Promise<boolean> {
    if (!batchOrder.backendOrderRef) return false;
    const result = await this.reader.readFulfillment(batchOrder.backendOrderRef.value);
    // Re-read so a refund (or other update) that landed since the page query is not advanced or
    // emailed from a stale snapshot; the repository save guard is the last line of defence.
    const order = (await this.repo.findById(batchOrder.id)) ?? batchOrder;
    const changed = order.applyFulfillment({
      backendStatus: result.status,
      tracking: result.tracking ?? order.tracking ?? emptyTracking(),
    });
    if (!changed) return false;
    await this.repo.save(order);
    await this.publisher.publishAll(order.pullEvents());
    await this.email.emit(
      order,
      order.state === OrderLifecycleState.DELIVERED ? "order.delivered" : "order.shipped",
    );
    return true;
  }
}
