import { getCurrentTenantId } from "@/lib/tenant/context";
import { getBasePrisma } from "@/lib/db";
import { getConfig } from "@/lib/config/get-config";
import { OutboxEventPublisher } from "@/modules/platform/infra/outbox-event-publisher";
import { getTenantPrisma } from "@/modules/platform/infra/prisma-tenant-extension";
import { makeReadFulfillmentService } from "@/composition/make-commerce-gateway";
import { realMessaging } from "@/composition/order-fulfillment-deps";
import type { OrderFulfillmentDeps } from "@/composition/make-order-fulfillment";
import type { CommerceBackendFulfillmentPort } from "@/modules/order-fulfillment/infra/commerce/backend-fulfillment-reader.client";
import type { DomainEventPublisherPort } from "@/modules/order-fulfillment/application/ports";

// gateway returns `carrier`, the reader reads `trackingCarrier`; adapt here.
export async function buildOrderFulfillmentCronDeps(): Promise<OrderFulfillmentDeps> {
  const readFulfillment = await makeReadFulfillmentService();
  const gatewayFulfillment: CommerceBackendFulfillmentPort = {
    readFulfillmentStatus: async (backendOrderRef: string) => {
      const r = await readFulfillment.readFulfillmentStatus(backendOrderRef);
      return {
        status: r.status,
        trackingNumber: r.trackingNumber,
        trackingCarrier: r.carrier,
        trackingUrl: r.trackingUrl,
      };
    },
  };
  const ecommerce = await getConfig<{ credentials?: { disableNotifications?: boolean } }>(
    "ecommerce.config",
  );
  const outbox = new OutboxEventPublisher(getBasePrisma());
  const eventPublisher: DomainEventPublisherPort = {
    publishAll: async (events) => {
      await outbox.publishMany(
        events.map((e) => ({
          eventId: crypto.randomUUID(),
          type: e.type,
          tenantId: getCurrentTenantId(),
          occurredAt: new Date(),
          payload: { orderId: e.orderId, saleRef: e.saleRef, state: e.state },
          correlation: { saleRef: e.saleRef },
        })),
      );
    },
  };
  return {
    db: getTenantPrisma() as never,
    gatewayFulfillment,
    messaging: realMessaging,
    eventPublisher,
    disableNotifications: async () => ecommerce?.credentials?.disableNotifications ?? true,
    newOrderId: () => crypto.randomUUID(),
  };
}
