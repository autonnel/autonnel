import pLimit from 'p-limit';
import { defineRoute } from '@/lib/api/define-route';
import { makeLiveStorefrontCatalogReadSide } from '@/composition/make-commerce-gateway';
import { createLogger } from '@/lib/logger';

// A public URL must not amplify into unbounded outbound calls against the commerce provider.
export const MAX_PRODUCT_IDS = 50;
export const PRODUCT_LOOKUP_CONCURRENCY = 6;
import { getDefaultCurrencyCode, toShopProductDto } from '@/lib/storefront/shop-catalog.mapper';
import type { StorefrontCatalogReadPort } from '@/modules/commerce-gateway/application/ports/inbound';
import type { ShopProductDto, ShopProductListDto, ShopProductSingleDto } from '@/contracts/shop';

const logger = createLogger('ShopProducts');

// The country becomes part of the live-catalog cache key, so it must not be free-form
// client input: an arbitrary Accept-Language region would mint an unbounded number of cache
// keys, each costing its own full upstream catalog fetch. Only well-formed ISO-3166 alpha-2
// codes are honoured; anything else falls back to the default market.
const COUNTRY_CODE = /^[A-Z]{2}$/;

function normalizeCountry(raw: string | null): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  return COUNTRY_CODE.test(upper) ? upper : null;
}

function countryFromRequest(request: Request): string {
  // cf-ipcountry is set by the edge and is not client-controllable behind Cloudflare.
  const cf = normalizeCountry(request.headers.get('cf-ipcountry'));
  if (cf) return cf;
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const parts = acceptLanguage.split(',')[0].trim().split('-');
    const region = parts.length > 1 ? normalizeCountry(parts[1]) : null;
    if (region) return region;
  }
  return 'US';
}

// regionId carries the buyer-selected currency (regions are currency-keyed). "default" / skipPricing
// means "no specific currency" — resolve against the configured default currency instead.
function resolveCurrency(regionId: string | null, skipPricing: boolean): string | undefined {
  if (skipPricing) return undefined;
  if (!regionId || regionId === 'default') return undefined;
  return regionId.toUpperCase();
}

export const GET = defineRoute(
  'GET /api/shop/products',
  {},
  async ({ query, request }): Promise<ShopProductListDto | ShopProductSingleDto> => {
    const productIds = query.get('productIds');
    const productId = query.get('productId');
    const regionId = query.get('regionId');
    const skipPricing = query.get('skipPricing') === 'true';
    const action = query.get('action') || 'list';
    const searchQuery = query.get('q')?.trim() || '';
    const limitParam = parseInt(query.get('limit') || '', 10);
    const offsetParam = parseInt(query.get('offset') || '', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

    const currencyCode = resolveCurrency(regionId, skipPricing);
    const countryCode = countryFromRequest(request);
    const fallbackCurrency = currencyCode ?? getDefaultCurrencyCode();
    const priceQuery = { currencyCode, countryCode };

    let read: StorefrontCatalogReadPort;
    try {
      read = await makeLiveStorefrontCatalogReadSide({ countryCode });
    } catch {
      return { products: [], message: 'E-commerce adapter not configured.' };
    }

    const toDto = (view: Parameters<typeof toShopProductDto>[0]): ShopProductDto =>
      toShopProductDto(view, fallbackCurrency);

    try {
      if (action === 'single' && productId) {
        const view = await read.getByRef(productId, priceQuery);
        return { product: view ? toDto(view) : null, regionId };
      }

      if (productIds || productId) {
        const requested = productIds
          ? productIds.split(',').map((id) => id.trim()).filter(Boolean)
          : [productId as string];
        const ids = [...new Set(requested)].slice(0, MAX_PRODUCT_IDS);
        if (requested.length > ids.length) {
          // Logged, never silent: a truncated result would otherwise read as "all unavailable".
          logger.warn('Truncated productIds fan-out', { requested: requested.length, dispatched: ids.length });
        }
        const gate = pLimit(PRODUCT_LOOKUP_CONCURRENCY);
        const views = await Promise.all(
          ids.map((id) => gate(() => read.getByRef(id, priceQuery).catch(() => null))),
        );
        return {
          products: views.filter((v): v is NonNullable<typeof v> => v !== null).map(toDto),
          regionId,
        };
      }

      if (searchQuery) {
        const views = await read.search(searchQuery, { limit, offset, ...priceQuery });
        return {
          products: views.map(toDto),
          regionId,
          limit,
          offset,
          hasMore: views.length === limit,
        };
      }

      const result = await read.list({ limit, offset, ...priceQuery });
      return {
        products: result.products.map(toDto),
        regionId,
        limit,
        offset,
        hasMore: result.hasMore,
      };
    } catch (readError) {
      logger.error('Storefront catalog read error', { error: readError });
      return { products: [], error: 'Failed to fetch from e-commerce system.' };
    }
  },
);
