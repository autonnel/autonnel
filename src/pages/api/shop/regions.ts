import { defineRoute } from '@/lib/api/define-route';
import {
  makeCommerceGatewayReadSide,
  makeLiveStorefrontCatalogReadSide,
} from '@/composition/make-commerce-gateway';
import { getDefaultCurrencyCode } from '@/lib/storefront/shop-catalog.mapper';
import type { ShopRegionDto, ShopRegionListDto } from '@/contracts/shop';

// Regions are cosmetic: the storefront only needs a currency selector. Each region maps 1:1 to a
// currency code (id == currencyCode). The list is the configured default currency plus any
// currencies actually present in the catalog projection.
function toRegion(currencyCode: string): ShopRegionDto {
  return { id: currencyCode, name: currencyCode, currencyCode, countries: [] };
}

export const GET = defineRoute('GET /api/shop/regions', {}, async (): Promise<ShopRegionListDto> => {
  const defaultCurrency = getDefaultCurrencyCode();

  let catalogCurrencies: string[] = [];
  try {
    catalogCurrencies = await (await makeLiveStorefrontCatalogReadSide()).availableCurrencies();
  } catch {
    catalogCurrencies = [];
  }

  const codes = Array.from(new Set([defaultCurrency, ...catalogCurrencies]));
  const regions = codes.map(toRegion);

  let supportsMultiCurrency = codes.length > 1;
  try {
    const port = await makeCommerceGatewayReadSide();
    const profile = await port.describeCapabilities();
    supportsMultiCurrency = profile.upstreamFlags().supportsMultiCurrency;
  } catch {
    // backend not configured / unavailable; fall back to the currency-count heuristic
  }

  return { regions, supportsMultiCurrency };
});
