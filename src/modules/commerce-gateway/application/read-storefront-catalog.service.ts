import type { CatalogProjectionStorePort } from "./ports/outbound";
import type {
  StorefrontCatalogReadPort,
  StorefrontCatalogQuery,
  StorefrontCatalogListResult,
  StorefrontProductView,
  StorefrontVariantView,
} from "./ports/inbound";
import { CatalogProductView, CatalogVariantView } from "../domain/catalog-projection";
import { ExternalRef } from "../domain/value-objects/external-ref";
import { Market } from "../domain/value-objects/market";
import { Money } from "../../shared-kernel/money";

export class ReadStorefrontCatalogService implements StorefrontCatalogReadPort {
  constructor(private readonly store: CatalogProjectionStorePort) {}

  async list(query: StorefrontCatalogQuery): Promise<StorefrontCatalogListResult> {
    const { products, hasMore } = await this.store.listProducts(query.limit, query.offset);
    return { products: products.map((p) => toProductView(p, query)), hasMore };
  }

  async getByRef(
    ref: string,
    query: Omit<StorefrontCatalogQuery, "limit" | "offset">,
  ): Promise<StorefrontProductView | null> {
    const product = await this.store.findByProductRef(ExternalRef.of(ref));
    return product ? toProductView(product, query) : null;
  }

  async search(term: string, query: StorefrontCatalogQuery): Promise<StorefrontProductView[]> {
    const products = await this.store.search(term, query.limit);
    return products.map((p) => toProductView(p, query));
  }

  async availableCurrencies(): Promise<string[]> {
    return this.store.distinctCurrencyCodes(CURRENCY_SCAN_LIMIT);
  }
}

const CURRENCY_SCAN_LIMIT = 500;

interface PriceQuery {
  currencyCode?: string;
  countryCode?: string;
}

function resolveVariantPrice(variant: CatalogVariantView, query: PriceQuery): Money | undefined {
  const prices = variant.presentmentPrices;
  if (query.countryCode && query.currencyCode) {
    const exact = prices.resolve(Market.of(query.countryCode, query.currencyCode));
    if (exact) return exact;
  }
  if (query.currencyCode) {
    const byCurrency = prices.resolveByCurrency(query.currencyCode);
    if (byCurrency) return byCurrency;
  }
  return prices.first();
}

// Mirrors resolveVariantPrice so the compare-at price is read from the same market the
// displayed price was resolved against.
function resolveVariantComparePrice(variant: CatalogVariantView, query: PriceQuery): Money | undefined {
  const prices = variant.presentmentPrices;
  if (query.countryCode && query.currencyCode) {
    const exactMarket = Market.of(query.countryCode, query.currencyCode);
    if (prices.resolve(exactMarket)) return prices.resolveCompare(exactMarket);
  }
  if (query.currencyCode) {
    if (prices.resolveByCurrency(query.currencyCode)) {
      return prices.resolveCompareByCurrency(query.currencyCode);
    }
  }
  return prices.firstCompare();
}

function toVariantView(
  variant: CatalogVariantView,
  productThumbnail: string | null,
  query: PriceQuery,
): StorefrontVariantView {
  const money = resolveVariantPrice(variant, query);
  const compareMoney = resolveVariantComparePrice(variant, query);
  return {
    ref: variant.externalVariantRef.toString(),
    title: variant.title,
    sku: variant.sku,
    priceMinor: money ? money.amountMinor : null,
    comparePriceMinor: compareMoney ? compareMoney.amountMinor : null,
    currencyCode: money ? money.currencyCode : null,
    thumbnail: productThumbnail,
  };
}

function toProductView(product: CatalogProductView, query: PriceQuery): StorefrontProductView {
  const thumbnail = product.mediaRefs[0] ?? null;
  const variants = product.variants.map((v) => toVariantView(v, thumbnail, query));
  const lead = variants.find((v) => v.priceMinor !== null);
  return {
    ref: product.externalProductRef.toString(),
    title: product.title,
    status: product.status,
    thumbnail,
    mediaRefs: product.mediaRefs,
    priceMinor: lead ? lead.priceMinor : null,
    comparePriceMinor: lead ? lead.comparePriceMinor : null,
    currencyCode: lead ? lead.currencyCode : null,
    variants,
  };
}
