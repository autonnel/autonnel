import { createLogger } from '@/lib/logger';
import {
  parseVariantIds,
  variantIdMatches,
  variantRefCandidates,
} from '@/lib/storefront/variant-params';
import type { PreselectedItems } from '@/lib/storefront/preselected-items';
import type { SelectedItem } from '@/components/builder/blocks/product-selection-types';
import type {
  CatalogReadPort,
  StorefrontCatalogReadPort,
  StorefrontProductView,
} from '@/modules/commerce-gateway/application/ports/inbound';
import type { Purchasable } from '@/modules/commerce-gateway/domain/value-objects/purchasable';
import { Market } from '@/modules/commerce-gateway/domain/value-objects/market';
import { ExternalRef } from '@/modules/commerce-gateway/domain/value-objects/external-ref';
import { checkoutMarket, isSellablePurchasable, marketForCurrency, type CheckoutMarket } from './checkout-market';
import { makeLiveCheckoutReadSides } from './make-commerce-gateway';

const logger = createLogger('StorefrontPreselection');
// Backends name the only variant of a simple product with a placeholder (Shopify, WooCommerce).
const PLACEHOLDER_VARIANT_TITLES = new Set(['Default Title', 'Default']);

export function toSelectedItem(
  purchasable: Purchasable & { price: NonNullable<Purchasable['price']> },
  view: StorefrontProductView | null,
): SelectedItem {
  const { price } = purchasable;
  const variantRef = purchasable.variantRef.toString();
  const variant = view?.variants.find((v) => v.ref === variantRef);
  const item: SelectedItem = {
    id: variantRef,
    productId: purchasable.productRef.toString(),
    productName: view?.title ?? purchasable.title,
    price: price.amountMinor / 100,
    quantity: 1,
    currency: price.currencyCode,
  };
  if (variant?.title && !PLACEHOLDER_VARIANT_TITLES.has(variant.title)) item.variantName = variant.title;
  const compareMinor = variant?.comparePriceMinor ?? null;
  if (compareMinor !== null && variant?.currencyCode === price.currencyCode && compareMinor > price.amountMinor) {
    item.comparePrice = compareMinor / 100;
  }
  const thumbnail = variant?.thumbnail ?? view?.thumbnail ?? purchasable.mediaRefs[0];
  if (thumbnail) item.thumbnail = thumbnail;
  return item;
}

// Keeps the request order, drops unresolvable/unsellable ids, and keeps one currency because a
// cart cannot mix them.
export function buildPreselectedItems(
  requestedIds: string[],
  purchasables: Purchasable[],
  viewsByProductRef: Map<string, StorefrontProductView | null>,
): PreselectedItems | null {
  const items: SelectedItem[] = [];
  for (const id of requestedIds) {
    const match = purchasables.find((p) => variantIdMatches(p.variantRef.toString(), id));
    if (!isSellablePurchasable(match)) continue;
    if (items.some((i) => i.id === match.variantRef.toString())) continue;
    items.push(toSelectedItem(match, viewsByProductRef.get(match.productRef.toString()) ?? null));
  }
  if (items.length === 0) return null;
  const currency = items[0].currency as string;
  return { items: items.filter((i) => i.currency === currency), currency, regionId: currency };
}

export interface PreselectionDeps {
  market: CheckoutMarket;
  loadReadSides(countryCode: string): Promise<{
    purchasables: Pick<CatalogReadPort, 'resolvePurchasables'>;
    storefront: Pick<StorefrontCatalogReadPort, 'getByRef'>;
  }>;
}

function defaultDeps(): PreselectionDeps {
  return { market: checkoutMarket(), loadReadSides: makeLiveCheckoutReadSides };
}

// Display and selection seeding only: the cart re-prices every line server-side on add.
// Lookups go through the live catalog store, which caches the whole catalog per tenant+country
// (in-process and shared KV), so unknown ids are answered from cache without extra upstream calls.
export async function resolvePreselectedItems(
  rawVariantParam: string | null,
  deps: PreselectionDeps = defaultDeps(),
  pageCurrency?: string | null,
): Promise<PreselectedItems | null> {
  const ids = parseVariantIds(rawVariantParam);
  const rawCount = rawVariantParam ? rawVariantParam.split(',').filter((s) => s.trim()).length : 0;
  if (rawCount > ids.length) {
    logger.warn('Dropped invalid, duplicate or excess variant ids', { received: rawCount, kept: ids.length });
  }
  if (ids.length === 0) return null;

  try {
    const market = pageCurrency ? marketForCurrency(pageCurrency) : deps.market;
    const sides = await deps.loadReadSides(market.countryCode);
    const purchasables = await sides.purchasables.resolvePurchasables({
      variantRefs: ids.flatMap(variantRefCandidates).map((ref) => ExternalRef.of(ref)),
      market: Market.of(market.countryCode, market.currencyCode),
    });
    const productRefs = [...new Set(purchasables.filter(isSellablePurchasable).map((p) => p.productRef.toString()))];
    const views = await Promise.all(
      productRefs.map((ref) =>
        sides.storefront.getByRef(ref, { countryCode: market.countryCode, currencyCode: market.currencyCode }).catch(() => null),
      ),
    );
    const result = buildPreselectedItems(ids, purchasables, new Map(productRefs.map((ref, i) => [ref, views[i]])));
    const resolved = result?.items.length ?? 0;
    if (resolved < ids.length) {
      logger.info('Some preselected variants were not resolved', { requested: ids, resolved });
    }
    return result;
  } catch (error) {
    logger.warn('Preselected variant lookup failed', { error, requested: ids });
    return null;
  }
}
