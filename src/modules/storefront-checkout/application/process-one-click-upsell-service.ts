import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { PriceSnapshot } from '../domain/value-objects/price-snapshot';
import { OfferLineItem } from '../domain/value-objects/offer-line-item';
import { saleEvents } from '../domain/events';
import type { CommerceCatalogReaderPort, DomainEventPublisherPort, FunnelSessionStorePort, PaymentCapturePort } from './ports/outbound';
import { buildCheckoutSnapshot } from './checkout-snapshot';

export interface OneClickUpsellDeps {
  sessions: FunnelSessionStorePort;
  catalog: CommerceCatalogReaderPort;
  payments: PaymentCapturePort;
  publisher: DomainEventPublisherPort;
  newSaleId: () => string;
  clock: () => Date;
  market: { countryCode: string; currencyCode: string };
}

export class ProcessOneClickUpsellService {
  constructor(private readonly deps: OneClickUpsellDeps) {}

  async execute(sessionId: string, input: { variantExternalId: string; quantity: number }): Promise<{ saleRef: string; clientHandle: string }> {
    const session = await this.deps.sessions.load(sessionId);
    if (!session) throw new Error('FunnelSession not found');
    if (!session.buyer) throw new Error('Upsell requires the main-checkout buyer to be attached');
    const [view] = await this.deps.catalog.resolve([input.variantExternalId], this.deps.market);
    if (!view || !view.sellable) throw new Error('Upsell variant is not sellable');

    const line = OfferLineItem.create({
      variantExternalId: ExternalRef.of(view.variantExternalId),
      title: view.title,
      quantity: input.quantity,
      unitPrice: PriceSnapshot.create(Money.of(view.unitPriceMinor, view.currencyCode), this.deps.clock()),
    });
    // Independent captured-sale record correlated by sessionId (not a parent/child graph).
    const buyer = session.upsellBuyerContact();
    const capturedTotal = line.lineTotal();
    const saleRef = this.deps.newSaleId();

    const snapshot = buildCheckoutSnapshot({ lines: [line], buyer, sessionId: session.sessionId, funnelId: session.snapshotRef.funnelId });
    const { clientHandle } = await this.deps.payments.createIntent(saleRef, capturedTotal, 'automatic', undefined, snapshot);

    await this.deps.publisher.publish([
      saleEvents.checkoutSubmitted({
        saleRef,
        sessionId: session.sessionId,
        hashedIdentity: buyer.handle.hashedIdentity,
      }),
    ]);
    return { saleRef, clientHandle };
  }
}
