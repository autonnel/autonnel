import { Money } from '../../shared-kernel/money';
import { PaymentIntent } from '../domain/payment-intent';
import {
  SaleRef, CaptureMethod, ProviderRef, ClientHandle,
} from '../domain/value-objects';
import type { PspSlug } from '../domain/value-objects';
import { ProviderSelectionPolicy } from '../domain/provider-selection-policy';
import { PaymentEventType } from '../domain/events';
import type { PaymentProviderPort, PaymentIntentRepositoryPort, TenantConfigPort } from './ports/outbound';
import type { DomainEventPublisherPort } from '../../shared-kernel/event-envelope';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('CreatePaymentIntentService');

export interface CreatePaymentIntentDeps {
  providerFor: (slug: PspSlug) => Promise<PaymentProviderPort>;
  intentRepo: PaymentIntentRepositoryPort;
  tenantConfig: TenantConfigPort;
  events: DomainEventPublisherPort;
  newIntentId: () => string;
}

export interface CreatePaymentIntentInput {
  saleRef: SaleRef;
  amount: Money;
  captureMethod: CaptureMethod;
  provider?: PspSlug;
  // Opaque checkout-time blob; carried onto the intent for later contexts.
  checkoutSnapshot?: unknown;
}

export class CreatePaymentIntentService {
  private readonly selection = new ProviderSelectionPolicy();
  constructor(private readonly deps: CreatePaymentIntentDeps) {}

  async create(input: CreatePaymentIntentInput): Promise<{ intentId: string; clientHandle: ClientHandle; providerIntentId: string }> {
    if (!input.amount.isPositive()) throw new Error('PaymentIntent requires Money > 0');

    const existing = await this.deps.intentRepo.findBySaleRef(input.saleRef.value);
    if (existing && existing.status === 'REQUIRES_PAYMENT' && existing.providerRef) {
      return { intentId: existing.id, clientHandle: ClientHandle.stripeClientSecret(''), providerIntentId: existing.providerRef.providerIntentId };
    }

    const configured = await this.deps.tenantConfig.configuredProviders();
    const slug = this.selection.select(input.provider ?? configured[0], configured);
    const provider = await this.deps.providerFor(slug);

    const intent = PaymentIntent.create({
      id: this.deps.newIntentId(),
      saleRef: input.saleRef,
      provider: slug,
      amount: input.amount,
      captureMethod: input.captureMethod,
      checkoutSnapshot: input.checkoutSnapshot,
    });

    const created = await provider.createIntent({
      amountMinor: input.amount.amountMinor,
      currencyCode: input.amount.currencyCode,
      captureMethod: input.captureMethod,
      idempotencyKey: `create:${input.saleRef.value}`,
      saleRef: input.saleRef.value,
    });

    intent.bindProvider(ProviderRef.of(slug, created.providerRef.providerIntentId));
    if (created.vaultCustomerId) intent.setStripeVault({ customerId: created.vaultCustomerId });
    await this.deps.intentRepo.save(intent);
    await this.deps.events.publish({ type: PaymentEventType.PaymentIntentCreated, saleRef: input.saleRef.value, payload: { intentId: intent.id, provider: slug } } as any);

    logger.info('Payment intent created', { intentId: intent.id, provider: slug });
    const handle = created.clientHandle.kind === 'client_secret'
      ? ClientHandle.stripeClientSecret(created.clientHandle.value)
      : ClientHandle.paypalApprovalUrl(created.clientHandle.value);
    return { intentId: intent.id, clientHandle: handle, providerIntentId: created.providerRef.providerIntentId };
  }
}
