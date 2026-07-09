import type { PrismaClient } from '@prisma/client';
import { IdempotencyKey } from '@/modules/shared-kernel/idempotency-key';
import { CommerceHandoffClient, type CommerceHandoffInboundPort } from '@/modules/storefront-checkout/infra/clients/commerce-handoff-client';
import { HandoffPayloadAssembler } from '@/modules/storefront-checkout/domain/services/handoff-payload-assembler';
import { HandoffSaleService } from '@/modules/storefront-checkout/application/handoff-sale-service';
import { CheckoutPaymentStatusService } from '@/modules/storefront-checkout/application/checkout-payment-status-service';
import { AbandonmentDetectionService } from '@/modules/storefront-checkout/application/abandonment-detection-service';
import type { DomainEventPublisherPort, JobQueuePort, PaymentSnapshotReaderPort } from '@/modules/storefront-checkout/application/ports/outbound';

export interface StorefrontConsumerDeps {
  prisma: PrismaClient;
  tenantId: string;
  handoffPort: CommerceHandoffInboundPort;
  eventPublisher: DomainEventPublisherPort;
  jobQueue: JobQueuePort;
  paymentSnapshots: PaymentSnapshotReaderPort;
  keyFor?: (tenantId: string, saleId: string) => IdempotencyKey;
}

export function makeStorefrontConsumers(d: StorefrontConsumerDeps) {
  const keyFor = d.keyFor ?? ((t: string, s: string) => IdempotencyKey.derive(t, s));
  const handoff = new CommerceHandoffClient(d.handoffPort);
  const assembler = new HandoffPayloadAssembler(keyFor);
  const paymentStatus = new CheckoutPaymentStatusService(d.paymentSnapshots);

  return {
    handoffHandler: new HandoffSaleService({ paymentSnapshots: d.paymentSnapshots, handoff, publisher: d.eventPublisher, assembler, tenantId: d.tenantId }),
    paymentStatus,
    abandonment: new AbandonmentDetectionService({ publisher: d.eventPublisher, isLinkedSalePaid: (saleId: string) => paymentStatus.isPaid(saleId) }),
  };
}
