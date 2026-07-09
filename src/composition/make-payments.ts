import { getBasePrisma } from '../lib/db';
import { getTenantPrisma } from '../modules/platform/infra/prisma-tenant-extension';
import { PrismaPaymentIntentRepository } from '../modules/payments/infra/prisma/payment-intent.repository';
import { PrismaTransactionRepository } from '../modules/payments/infra/prisma/transaction.repository';
import { AppConfigTenantConfigAdapter } from '../modules/payments/infra/config/tenant-config.adapter';
import { createPaymentProvider } from '../modules/payments/infra/providers/provider-factory';
import { CreatePaymentIntentService } from '../modules/payments/application/create-payment-intent.service';
import { ConfirmCardPaymentService } from '../modules/payments/application/confirm-card-payment.service';
import { ConfirmPayPalOrderService } from '../modules/payments/application/confirm-paypal-order.service';
import { IssueRefundService } from '../modules/payments/application/issue-refund.service';
import { GetPaymentStatusService } from '../modules/payments/application/get-payment-status.service';
import { ReconcilePendingIntentsService } from '../modules/payments/application/reconcile-pending-intents.service';
import { TransactionQueryService } from '../modules/payments/application/transaction-query.service';
import { PrismaTransactionReadAdapter } from '../modules/payments/infra/prisma/transaction-read.adapter';
import { OutboxEventPublisher } from '../modules/platform/infra/outbox-event-publisher';
import { TenantEventPublisher } from '../modules/platform/infra/tenant-event-publisher';
import type { PspSlug } from '../modules/payments/domain/value-objects';

const tenantConfig = new AppConfigTenantConfigAdapter();
const newId = () => crypto.randomUUID();

// TenantEventPublisher enriches the raw { type, payload } event with the ALS tenantId +
// a fresh eventId/occurredAt before the outbox write (OutboxEventPublisher does NOT).
function eventPublisher() {
  return new TenantEventPublisher(new OutboxEventPublisher(getBasePrisma())) as never;
}

async function providerFor(slug: PspSlug) {
  return createPaymentProvider(slug, await tenantConfig.providerConfig(slug));
}

export function makePaymentsCommand() {
  const intentRepo = new PrismaPaymentIntentRepository(getTenantPrisma());
  return new CreatePaymentIntentService({ providerFor, intentRepo, tenantConfig, events: eventPublisher(), newIntentId: newId });
}

export function makeConfirmCardPayment() {
  return new ConfirmCardPaymentService({ providerFor, intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), events: eventPublisher() });
}

export function makeConfirmPayPalOrder() {
  return new ConfirmPayPalOrderService({ providerFor, intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), events: eventPublisher() });
}

export function makePaymentsRefund() {
  return new IssueRefundService({ providerFor, intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), txRepo: new PrismaTransactionRepository(getTenantPrisma()), events: eventPublisher(), newRefundId: newId });
}

export function makePaymentsQuery() {
  return new GetPaymentStatusService({ intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()) });
}

export function makeTransactionQuery() {
  return new TransactionQueryService(new PrismaTransactionReadAdapter(getTenantPrisma() as never));
}

export function makePaymentsReconcile() {
  return new ReconcilePendingIntentsService({ providerFor, intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), events: eventPublisher(), staleAfterMs: 10 * 60 * 1000, batchSize: 50 });
}

// Safety-net deps for capturing abandoned PayPal merged-upsell orders (orders.auto-capture cron).
export function makeDeferredCaptureDeps() {
  return { intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), confirm: makeConfirmPayPalOrder() };
}

