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

async function loadAdapters(country?: string) {
  const creds = await new AppConfigBackendCredentials().load();
  if (!creds || !creds.isActive) throw new Error("commerce backend not configured");
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
