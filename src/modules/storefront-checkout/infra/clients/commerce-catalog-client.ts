import type { CommerceCatalogReaderPort, PurchasableView } from '../../application/ports/outbound';

export interface PurchasableDto {
  variantExternalId: string;
  title: string;
  price: { amountMinor: number; currencyCode: string } | null;
  sellable: boolean;
}

export interface CatalogReadPort {
  resolve(variantExternalIds: string[], market: { countryCode: string; currencyCode: string }): Promise<PurchasableDto[]>;
}

export class CommerceCatalogClient implements CommerceCatalogReaderPort {
  constructor(private readonly catalog: CatalogReadPort) {}

  async resolve(ids: string[], market: { countryCode: string; currencyCode: string }): Promise<PurchasableView[]> {
    const views = await this.catalog.resolve(ids, market);
    return views.map((v) => ({
      variantExternalId: v.variantExternalId,
      title: v.title,
      unitPriceMinor: v.price?.amountMinor ?? 0,
      currencyCode: v.price?.currencyCode ?? market.currencyCode,
      sellable: v.sellable && v.price !== null,
    }));
  }
}
