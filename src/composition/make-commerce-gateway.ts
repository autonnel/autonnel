import { ResolvePurchasablesService } from "@/modules/commerce-gateway/application/resolve-purchasables.service";
import { SearchCatalogService } from "@/modules/commerce-gateway/application/search-catalog.service";
import { ReadStorefrontCatalogService } from "@/modules/commerce-gateway/application/read-storefront-catalog.service";
import { DescribeBackendCapabilitiesService } from "@/modules/commerce-gateway/application/describe-capabilities.service";
import { SubmitHandoffService } from "@/modules/commerce-gateway/application/submit-handoff.service";
import { ReadFulfillmentStatusService } from "@/modules/commerce-gateway/application/read-fulfillment-status.service";
import { SyncCatalogService } from "@/modules/commerce-gateway/application/sync-catalog.service";
import { PurchasableAssembler } from "@/modules/commerce-gateway/domain/services/purchasable-assembler";
import { PriceResolver } from "@/modules/commerce-gateway/domain/services/price-resolver";
import { SellabilityPolicy } from "@/modules/commerce-gateway/domain/services/sellability-policy";
import { HandoffTranslator } from "@/modules/commerce-gateway/domain/services/handoff-translator";
import { PrismaCatalogProjectionStore } from "@/modules/commerce-gateway/infra/prisma/catalog-projection-store";
import { LiveCachedCatalogStore } from "@/modules/commerce-gateway/infra/live/live-cached-catalog-store";
import { AppConfigBackendCredentials } from "@/modules/commerce-gateway/infra/backends/backend-credentials";
import { resolveBackendAdapters } from "@/modules/commerce-gateway/infra/backends/backend-resolver";
import type {
  CatalogReadPort,
  StorefrontCatalogReadPort,
} from "@/modules/commerce-gateway/application/ports/inbound";
import type {
  CatalogProjectionStorePort,
  BackendCatalogPort,
  BackendCurrencyRates,
} from "@/modules/commerce-gateway/application/ports/outbound";
import { getCurrentTenantId } from "@/lib/tenant/context";
import { OutboxEventPublisher } from "@/modules/platform/infra/outbox-event-publisher";
import { TenantEventPublisher } from "@/modules/platform/infra/tenant-event-publisher";
import { getTenantPrisma } from "@/modules/platform/infra/prisma-tenant-extension";
import { getBasePrisma } from "@/lib/db";

const INVENTORY_TTL_MS = 15 * 60 * 1000;

function assembler(): PurchasableAssembler {
  return new PurchasableAssembler(new PriceResolver(), new SellabilityPolicy(INVENTORY_TTL_MS));
}

function eventPublisher() {
  return new TenantEventPublisher(new OutboxEventPublisher(getBasePrisma()));
}

export function assembleCatalogReadPort(deps: {
  store: CatalogProjectionStorePort;
  backendCatalog: BackendCatalogPort;
}): CatalogReadPort {
  const resolve = new ResolvePurchasablesService(deps.store, assembler());
  const search = new SearchCatalogService(deps.store, assembler());
  const capabilities = new DescribeBackendCapabilitiesService(deps.backendCatalog);
  return {
    resolvePurchasables: (q) => resolve.execute(q),
    searchCatalog: (term, limit) => search.execute(term, limit),
    describeCapabilities: () => capabilities.execute(),
  };
}

export function assembleStorefrontCatalogReadPort(deps: {
  store: CatalogProjectionStorePort;
}): StorefrontCatalogReadPort {
  return new ReadStorefrontCatalogService(deps.store);
}

export class CommerceNotConfiguredError extends Error {
  constructor() {
    super("commerce backend not configured");
    this.name = "CommerceNotConfiguredError";
  }
}

async function loadAdapters(country?: string) {
  const creds = await new AppConfigBackendCredentials().load();
  if (!creds || !creds.isActive) throw new CommerceNotConfiguredError();
  return resolveBackendAdapters(creds.backendKind, creds, country);
}

// The money path (cart pricing, upsell pricing, post-payment price verification) resolves prices
// live from the backend through a short-TTL cache rather than the projection, so a customer is
// always charged the current catalog price. The cache (per tenant+country, 60s) bounds upstream
// API load under traffic spikes.
export async function makeCommerceGatewayReadSide(country?: string): Promise<CatalogReadPort> {
  const c = (country || "US").toUpperCase();
  const adapters = await loadAdapters(c);
  return assembleCatalogReadPort({
    store: new LiveCachedCatalogStore(adapters.catalog, `${getCurrentTenantId()}:${c}`),
    backendCatalog: adapters.catalog,
  });
}

// Storefront/Puck reads run purely off the projection (no backend round-trip), so this does
// not require an active backend configuration the way the handoff/sync paths do. Kept for the
// storefront thumbnail image-map, which intentionally reads the cached projection.
export function makeStorefrontCatalogReadSide(): StorefrontCatalogReadPort {
  return assembleStorefrontCatalogReadPort({
    store: new PrismaCatalogProjectionStore(getTenantPrisma()),
  });
}

// The admin product picker reads live from the configured commerce backend (not the projection
// table) so it always reflects the current catalog. Throws if no active backend is configured —
// callers surface that as "configure ecommerce first" rather than falling back to stale data.
export async function makeLiveStorefrontCatalogReadSide(
  opts: { countryCode?: string } = {},
): Promise<StorefrontCatalogReadPort> {
  const country = (opts.countryCode || "US").toUpperCase();
  const adapters = await loadAdapters(country);
  const store = new LiveCachedCatalogStore(adapters.catalog, `${getCurrentTenantId()}:${country}`);
  return assembleStorefrontCatalogReadPort({ store });
}

// Both ports share one live store, so a lookup that needs purchasable pricing and the grouped
// product view (compare price, thumbnail) costs a single cached catalog read.
export async function makeLiveCheckoutReadSides(countryCode: string): Promise<{
  purchasables: CatalogReadPort;
  storefront: StorefrontCatalogReadPort;
}> {
  const country = countryCode.toUpperCase();
  const adapters = await loadAdapters(country);
  const store = new LiveCachedCatalogStore(adapters.catalog, `${getCurrentTenantId()}:${country}`);
  return {
    purchasables: assembleCatalogReadPort({ store, backendCatalog: adapters.catalog }),
    storefront: assembleStorefrontCatalogReadPort({ store }),
  };
}

const CURRENCY_RATES_TTL_MS = 60_000;

type RatesCacheEntry = { value: Promise<BackendCurrencyRates | null>; expiry: number };

// Failures are never cached: a transient outage must not pin "no rates" for the TTL.
export function createCurrencyRatesReader(
  load: () => Promise<BackendCurrencyRates | null>,
  ttlMs: number,
  clock: () => number = Date.now,
  cache: Map<string, RatesCacheEntry> = new Map(),
): (tenantId: string) => Promise<BackendCurrencyRates | null> {
  return (tenantId) => {
    const now = clock();
    for (const [key, entry] of cache) if (entry.expiry <= now) cache.delete(key);
    const hit = cache.get(tenantId);
    if (hit) return hit.value;
    const entry: RatesCacheEntry = { value: load(), expiry: now + ttlMs };
    cache.set(tenantId, entry);
    entry.value.catch(() => {
      if (cache.get(tenantId) === entry) cache.delete(tenantId);
    });
    return entry.value;
  };
}

// Coupon amounts are converted into the cart currency with the backend's fixed rates. No backend,
// or one without a rates concept (real Shopify, WooCommerce), answers null; a failed read throws.
const currencyRatesByTenant = createCurrencyRatesReader(async () => {
  let adapters;
  try {
    adapters = await loadAdapters();
  } catch (err) {
    if (err instanceof CommerceNotConfiguredError) return null;
    throw err;
  }
  return (await adapters.catalog.currencyRates?.()) ?? null;
}, CURRENCY_RATES_TTL_MS);

export function readCurrencyRates(): Promise<BackendCurrencyRates | null> {
  return currencyRatesByTenant(getCurrentTenantId());
}

export async function makeSubmitHandoffService(): Promise<SubmitHandoffService> {
  const adapters = await loadAdapters();
  return new SubmitHandoffService(
    adapters.order,
    adapters.catalog,
    new HandoffTranslator(),
    eventPublisher(),
    getCurrentTenantId,
  );
}

export async function makeReadFulfillmentService(): Promise<ReadFulfillmentStatusService> {
  const adapters = await loadAdapters();
  return new ReadFulfillmentStatusService(adapters.fulfillment);
}

export async function makeSyncCatalogService(): Promise<SyncCatalogService> {
  const adapters = await loadAdapters();
  return new SyncCatalogService(adapters.catalog, new PrismaCatalogProjectionStore(getTenantPrisma()), eventPublisher());
}

export interface CommerceCronDeps {
  makeSyncCatalogService: () => Promise<Pick<SyncCatalogService, "execute">>;
}

export function makeCommerceCronDeps(): CommerceCronDeps {
  return { makeSyncCatalogService };
}
