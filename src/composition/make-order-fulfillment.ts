import type { PrismaClient } from "@prisma/client";
import { PrismaOrderRepository } from "@/modules/order-fulfillment/infra/prisma/order.repository";
import { CommerceGatewayFulfillmentReader } from "@/modules/order-fulfillment/infra/commerce/backend-fulfillment-reader.client";
import type { CommerceBackendFulfillmentPort } from "@/modules/order-fulfillment/infra/commerce/backend-fulfillment-reader.client";
import { MessagingClient } from "@/modules/order-fulfillment/infra/messaging/messaging.client";
import type { SendNotificationPort } from "@/modules/order-fulfillment/infra/messaging/messaging.client";
import { ConfigBrandingInfoAdapter } from "@/modules/order-fulfillment/infra/branding/branding-info.adapter";
import { EmitLifecycleEmailService } from "@/modules/order-fulfillment/application/emit-lifecycle-email.service";
import type { DisableNotificationsResolver } from "@/modules/order-fulfillment/application/emit-lifecycle-email.service";
import { CreateOrderFromPaidSaleService } from "@/modules/order-fulfillment/application/create-order-from-paid-sale.service";
import type { OrderIdFactory } from "@/modules/order-fulfillment/application/create-order-from-paid-sale.service";
import { AttachBackendRefService } from "@/modules/order-fulfillment/application/attach-backend-ref.service";
import { HandleRefundIssuedService } from "@/modules/order-fulfillment/application/handle-refund-issued.service";
import { SyncFulfillmentStatusService } from "@/modules/order-fulfillment/application/sync-fulfillment-status.service";
import { MarkOrderDeliveredService } from "@/modules/order-fulfillment/application/mark-order-delivered.service";
import { SetOrderNoteService } from "@/modules/order-fulfillment/application/set-order-note.service";
import { ResendReceiptEmailService } from "@/modules/order-fulfillment/application/resend-receipt-email.service";
import type { DomainEventPublisherPort } from "@/modules/order-fulfillment/application/ports";

export interface OrderFulfillmentDeps {
  db: PrismaClient;
  gatewayFulfillment: CommerceBackendFulfillmentPort;
  messaging: SendNotificationPort;
  eventPublisher: DomainEventPublisherPort;
  disableNotifications: DisableNotificationsResolver;
  newOrderId: OrderIdFactory;
}

export interface OrderFulfillmentContext {
  createOrderFromPaidSale: CreateOrderFromPaidSaleService;
  attachBackendRef: AttachBackendRefService;
  handleRefundIssued: HandleRefundIssuedService;
  syncFulfillmentStatus: SyncFulfillmentStatusService;
  markOrderDelivered: MarkOrderDeliveredService;
  setOrderNote: SetOrderNoteService;
  resendReceiptEmail: ResendReceiptEmailService;
}

export function makeOrderFulfillment(deps: OrderFulfillmentDeps): OrderFulfillmentContext {
  const repo = new PrismaOrderRepository(deps.db);
  const reader = new CommerceGatewayFulfillmentReader(deps.gatewayFulfillment);
  const messaging = new MessagingClient(deps.messaging);
  const branding = new ConfigBrandingInfoAdapter();
  const email = new EmitLifecycleEmailService(messaging, deps.disableNotifications, branding);

  return {
    createOrderFromPaidSale: new CreateOrderFromPaidSaleService(
      repo,
      deps.eventPublisher,
      email,
      deps.newOrderId,
    ),
    attachBackendRef: new AttachBackendRefService(repo),
    handleRefundIssued: new HandleRefundIssuedService(repo, deps.eventPublisher, email),
    syncFulfillmentStatus: new SyncFulfillmentStatusService(repo, reader, deps.eventPublisher, email),
    markOrderDelivered: new MarkOrderDeliveredService(repo, deps.eventPublisher, email),
    setOrderNote: new SetOrderNoteService(repo),
    resendReceiptEmail: new ResendReceiptEmailService(repo, email),
  };
}
