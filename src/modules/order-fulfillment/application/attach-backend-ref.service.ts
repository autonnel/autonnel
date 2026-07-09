import { createLogger } from "@/lib/logger";
import { BackendOrderRef } from "../domain/value-objects";
import type { SaleRef } from "../domain/value-objects";
import type { OrderRepositoryPort } from "./ports";

const logger = createLogger("OrderFulfillment:AttachBackendRef");

// Handoff to the commerce backend is a downstream fulfillment step, not a gate on order existence.
// On a successful handoff we only enrich the already-created Order with its backend ref so the
// fulfillment cron can later poll tracking. The Order is created on payment capture, independently.
export class AttachBackendRefService {
  constructor(private readonly repo: OrderRepositoryPort) {}

  async handle(saleRef: SaleRef, backendRef: string): Promise<void> {
    const order = await this.repo.findBySaleRef(saleRef);
    if (!order) {
      logger.warn("handoff completed but no Order for SaleRef yet; skipping backend-ref attach", { saleRef });
      return;
    }
    if (order.backendOrderRef?.value === backendRef) return;
    order.backendOrderRef = BackendOrderRef.of(backendRef);
    await this.repo.save(order);
  }
}
