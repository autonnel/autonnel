import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { PriceSnapshot } from '../domain/value-objects/price-snapshot';
import { OfferLineItem } from '../domain/value-objects/offer-line-item';
import type { CommerceCatalogReaderPort, FunnelSessionStorePort } from './ports/outbound';

export interface AddToCartDeps {
  sessions: FunnelSessionStorePort;
  catalog: CommerceCatalogReaderPort;
  clock: () => Date;
  ttlSeconds: number;
  market: { countryCode: string; currencyCode: string };
}

export class AddToCartService {
  constructor(private readonly deps: AddToCartDeps) {}

  async execute(sessionId: string, input: { variantExternalId: string; quantity: number }): Promise<void> {
    const session = await this.deps.sessions.load(sessionId);
    if (!session) throw new Error('FunnelSession not found');
    const [view] = await this.deps.catalog.resolve([input.variantExternalId], this.deps.market);
    if (!view || !view.sellable) throw new Error('Variant is not sellable');
    const line = OfferLineItem.create({
      variantExternalId: ExternalRef.of(view.variantExternalId),
      title: view.title,
      quantity: input.quantity,
      unitPrice: PriceSnapshot.create(Money.of(view.unitPriceMinor, view.currencyCode), this.deps.clock()),
    });
    session.addLine(line);
    await this.deps.sessions.store(session, this.deps.ttlSeconds);
  }
}
