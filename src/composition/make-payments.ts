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
import { CompleteRedirectPaymentService } from '../modules/payments/application/complete-redirect-payment.service';
import { TransactionQueryService } from '../modules/payments/application/transaction-query.service';
import { PrismaTransactionReadAdapter } from '../modules/payments/infra/prisma/transaction-read.adapter';
import { OutboxEventPublisher } from '../modules/platform/infra/outbox-event-publisher';
import { TenantEventPublisher } from '../modules/platform/infra/tenant-event-publisher';
import type { PspSlug } from '../modules/payments/domain/value-objects';
import type { PaymentProviderPort } from '../modules/payments/application/ports/outbound';
import { getPluginPaymentProvider } from '../lib/plugins/payment-providers';
import { makePluginRuntime } from './plugin-runtime';
import { maybeDeferHandoff } from '../lib/storefront/defer-handoff';
import type { PaymentIntent } from '../modules/payments/domain/payment-intent';

const tenantConfig = new AppConfigTenantConfigAdapter();
const newId = () => crypto.randomUUID();

// TenantEventPublisher enriches the raw { type, payload } event with the ALS tenantId +
// a fresh eventId/occurredAt before the outbox write (OutboxEventPublisher does NOT).
function eventPublisher() {
  return new TenantEventPublisher(new OutboxEventPublisher(getBasePrisma())) as never;
}

export async function resolvePaymentProvider(slug: PspSlug): Promise<PaymentProviderPort> {
  const config = await tenantConfig.providerConfig(slug);
  const plugin = getPluginPaymentProvider(slug);
  if (plugin) return plugin.provider.create(config, makePluginRuntime(plugin.pluginName));
  return createPaymentProvider(slug, config);
}

export function makePaymentsCommand() {
  const intentRepo = new PrismaPaymentIntentRepository(getTenantPrisma());
  return new CreatePaymentIntentService({ providerFor: resolvePaymentProvider, intentRepo, tenantConfig, events: eventPublisher(), newIntentId: newId });
}

export function makeConfirmCardPayment() {
  return new ConfirmCardPaymentService({ providerFor: resolvePaymentProvider, intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), events: eventPublisher() });
}

export function makeConfirmPayPalOrder() {
  return new ConfirmPayPalOrderService({ providerFor: resolvePaymentProvider, intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), events: eventPublisher() });
}

export function makePaymentsRefund() {
  return new IssueRefundService({ providerFor: resolvePaymentProvider, intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), txRepo: new PrismaTransactionRepository(getTenantPrisma()), events: eventPublisher(), newRefundId: newId });
}

export function makePaymentsQuery() {
  return new GetPaymentStatusService({ intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()) });
}

export function makeTransactionQuery() {
  return new TransactionQueryService(new PrismaTransactionReadAdapter(getTenantPrisma() as never));
}

export function makePaymentsReconcile() {
  return new ReconcilePendingIntentsService({ providerFor: resolvePaymentProvider, intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), events: eventPublisher(), staleAfterMs: 10 * 60 * 1000, batchSize: 50, expireAfterMs: 24 * 60 * 60 * 1000 });
}

// Whichever source wins the capture (return redirect or provider notification) must decide the
// handoff deferral before the capture event reaches the drain.
async function deferHandoffForUpsell(intent: PaymentIntent): Promise<void> {
  const targets = (intent.checkoutSnapshot as { returnTargets?: { pageId?: unknown; funnelId?: unknown } } | null | undefined)?.returnTargets;
  const pageId = typeof targets?.pageId === 'string' ? targets.pageId : undefined;
  const funnelId = typeof targets?.funnelId === 'string' ? targets.funnelId : undefined;
  await maybeDeferHandoff(intent.saleRef.value, funnelId, pageId);
}

export function makeCompleteRedirectPayment() {
  return new CompleteRedirectPaymentService({
    providerFor: resolvePaymentProvider,
    intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()),
    events: eventPublisher(),
    beforePublish: deferHandoffForUpsell,
  });
}

// Safety-net deps for capturing abandoned PayPal merged-upsell orders (orders.auto-capture cron).
export function makeDeferredCaptureDeps() {
  return { intentRepo: new PrismaPaymentIntentRepository(getTenantPrisma()), confirm: makeConfirmPayPalOrder() };
}

