import type { APIContext } from "astro";
import { getTenantPrisma } from "../modules/platform/infra/prisma-tenant-extension";
import { OutboxEventPublisher } from "../modules/platform/infra/outbox-event-publisher";
import { TenantEventPublisher } from "../modules/platform/infra/tenant-event-publisher";
import { getBasePrisma } from "../lib/db";
import { makeMessaging } from "./make-messaging";
import { ChannelType } from "../modules/messaging/domain/value-objects";
import { makeReadFulfillmentService } from "./make-commerce-gateway";
import { getConfig } from "../lib/config/get-config";
import { toDomain } from "../modules/order-fulfillment/infra/prisma/order-mapper";
import type { OrderRow } from "../modules/order-fulfillment/infra/prisma/order-mapper";
import type { CommerceBackendFulfillmentPort } from "../modules/order-fulfillment/infra/commerce/backend-fulfillment-reader.client";
import type { SendNotificationPort } from "../modules/order-fulfillment/infra/messaging/messaging.client";
import type { OrderFulfillmentDeps } from "./make-order-fulfillment";
import type { OrderQueryPort, OrderView } from "../modules/order-fulfillment/application/ports";
import { OrderDashboardQueryService } from "../modules/order-fulfillment/application/order-dashboard-query.service";
import { PrismaOrderReadAdapter } from "../modules/order-fulfillment/infra/prisma/order-read.adapter";
import { PrismaOrderVisitReadAdapter } from "../modules/order-fulfillment/infra/prisma/order-visit-read.adapter";
import { PrismaOrderEmailReadAdapter } from "../modules/order-fulfillment/infra/prisma/order-email-read.adapter";
import { PrismaCustomerOrderTrackingReadAdapter } from "../modules/order-fulfillment/infra/prisma/customer-order-tracking-read.adapter";
import { CustomerOrderTrackingService } from "../modules/order-fulfillment/application/customer-order-tracking-read-model";

type Locals = APIContext["locals"];

// Real email sender: bridges to the messaging module (Dispatch row + async send job).
// Exported so the cron path wires the same sender instead of a silently-dropping no-op.
export const realMessaging: SendNotificationPort = {
  async send(input) {
    await makeMessaging().sendNotification.send({
      channel: input.channel as ChannelType,
      templateKey: input.templateKey,
      recipient: input.recipient,
      variables: input.mergeVariables,
      idempotencyKey: input.idempotencyKey,
      sourceContext: 'order-fulfillment',
      locale: input.locale,
    });
  },
};

const gatewayFulfillment: CommerceBackendFulfillmentPort = {
  async readFulfillmentStatus(backendOrderRef) {
    const service = await makeReadFulfillmentService();
    const raw = await service.readFulfillmentStatus(backendOrderRef);
    return {
      status: raw.status,
      trackingNumber: raw.trackingNumber,
      trackingCarrier: raw.carrier,
      trackingUrl: raw.trackingUrl,
    };
  },
};

async function resolveDisableNotifications(): Promise<boolean> {
  const config = await getConfig<{ credentials?: { disableNotifications?: boolean } }>(
    "ecommerce.config",
  );
  return config?.credentials?.disableNotifications ?? true;
}

export function buildOrderFulfillmentDeps(_locals?: Locals): OrderFulfillmentDeps {
  // order-fulfillment's publisher port is publishAll(OrderDomainEvent[]); adapt it onto the
  // outbox's single-event publish (TenantEventPublisher only implements publish()).
  const tenantPub = new TenantEventPublisher(new OutboxEventPublisher(getBasePrisma()));
  const eventPublisher = {
    async publishAll(events: { type: string; orderId: string; saleRef: { value: string }; state: string }[]) {
      for (const e of events) {
        await tenantPub.publish({ type: e.type, payload: { orderId: e.orderId, saleRef: e.saleRef.value, state: e.state } });
      }
    },
  };
  return {
    db: getTenantPrisma() as never,
    gatewayFulfillment,
    messaging: realMessaging,
    eventPublisher: eventPublisher as never,
    disableNotifications: resolveDisableNotifications,
    newOrderId: () => crypto.randomUUID(),
  };
}

function toView(row: OrderRow): OrderView {
  const order = toDomain(row);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    saleRef: order.saleRef,
    state: order.state,
    capturedTotalMinor: order.capturedTotal.amountMinor,
    currencyCode: order.capturedTotal.currencyCode,
    trackingNumber: order.tracking?.trackingNumber,
    customerEmail: order.customer.email,
  };
}

export function makeOrderQuery(_locals?: Locals): OrderQueryPort {
  const db = getTenantPrisma() as never as {
    order: {
      findMany(args: unknown): Promise<unknown[]>;
      findUnique(args: unknown): Promise<unknown | null>;
    };
  };
  return {
    async list(input) {
      const rows = await db.order.findMany({
        take: input.limit,
        skip: input.offset,
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => toView(r as OrderRow));
    },
    async get(orderId) {
      const row = await db.order.findUnique({ where: { id: orderId } });
      return row ? toView(row as OrderRow) : null;
    },
  };
}

export function makeOrderDashboardQuery(_locals?: Locals): OrderDashboardQueryService {
  const db = getTenantPrisma() as never;
  return new OrderDashboardQueryService(
    new PrismaOrderReadAdapter(db),
    new PrismaOrderVisitReadAdapter(db),
    new PrismaOrderEmailReadAdapter(db),
  );
}

export function makeOrderEmailMonitor(_locals?: Locals): PrismaOrderEmailReadAdapter {
  return new PrismaOrderEmailReadAdapter(getTenantPrisma() as never);
}

export function makeCustomerOrderTracking(_locals?: Locals): CustomerOrderTrackingService {
  return new CustomerOrderTrackingService(
    new PrismaCustomerOrderTrackingReadAdapter(getTenantPrisma() as never),
  );
}
