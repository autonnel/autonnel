import { CatalogProductView, CatalogVariantView } from "../catalog-projection";
import { Market } from "../value-objects/market";
import type { Purchasable } from "../value-objects/purchasable";
import { DEFAULT_MARKET } from "../value-objects/market";
import { PriceResolver } from "./price-resolver";
import { SellabilityPolicy } from "./sellability-policy";

export class PurchasableAssembler {
  constructor(
    private readonly priceResolver: PriceResolver,
    private readonly sellabilityPolicy: SellabilityPolicy,
  ) {}

  assemble(
    product: CatalogProductView,
    variant: CatalogVariantView,
    market: Market,
    now: Date,
  ): Purchasable {
    const price = this.priceResolver.resolve(variant.presentmentPrices, market, DEFAULT_MARKET);
    const sellability = this.sellabilityPolicy.evaluate({ price, inventory: variant.inventory, now });
    return {
      productRef: product.externalProductRef,
      variantRef: variant.externalVariantRef,
      title: `${product.title} - ${variant.title}`,
      market,
      price,
      sellability,
      mediaRefs: product.mediaRefs,
    };
  }
}
