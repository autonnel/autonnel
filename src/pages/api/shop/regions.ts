import { defineRoute } from '@/lib/api/define-route';
import {
  makeCommerceGatewayReadSide,
  makeLiveStorefrontCatalogReadSide,
  readCurrencyRates,
} from '@/composition/make-commerce-gateway';
import { getDefaultCurrencyCode } from '@/lib/storefront/shop-catalog.mapper';
import type { ShopRegionDto, ShopRegionListDto } from '@/contracts/shop';

// Regions are cosmetic: the storefront only needs a currency selector. Each region maps 1:1 to a
// currency code (id == currencyCode). The configured default comes first, then the backend's enabled
// currency list (rated or manual-only), or base plus rated currencies on backends that do not report
// the list, or (without rates) the catalog's currencies.
function toRegion(currencyCode: string): ShopRegionDto {
  return { id: currencyCode, name: currencyCode, currencyCode, countries: [] };
}

async function ratedCurrencies(): Promise<string[] | null> {
  try {
    const rates = await readCurrencyRates();
    if (!rates) return null;
    const listed = rates.currencies ?? [rates.baseCurrency, ...Object.keys(rates.rates)];
    return listed.map((c) => c.toUpperCase());
  } catch {
    return null;
  }
}

async function catalogCurrencies(defaultCurrency: string): Promise<string[]> {
  try {
    return [defaultCurrency, ...(await (await makeLiveStorefrontCatalogReadSide()).availableCurrencies())];
  } catch {
    return [defaultCurrency];
  }
}

export const GET = defineRoute('GET /api/shop/regions', {}, async (): Promise<ShopRegionListDto> => {
  const defaultCurrency = getDefaultCurrencyCode();
  const rated = await ratedCurrencies();
  const listed = rated ? [defaultCurrency, ...rated] : await catalogCurrencies(defaultCurrency);
  const codes = Array.from(new Set(listed));
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
