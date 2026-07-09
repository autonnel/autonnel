import type {
  BackendCatalogPort,
  CatalogProjectionStorePort,
  CatalogProjectionListResult,
} from "../../application/ports/outbound";
import { CatalogProductView } from "../../domain/catalog-projection";
import { SyncCursor } from "../../domain/value-objects/sync-cursor";
import { ExternalRef } from "../../domain/value-objects/external-ref";

const READ_ONLY = "LiveCachedCatalogStore is read-only (live backend reads only)";

export interface LiveCatalogCacheConfig {
  ttlMs: number;
  pageSize: number;
  maxProducts: number;
}

const DEFAULT_CONFIG: LiveCatalogCacheConfig = { ttlMs: 60_000, pageSize: 100, maxProducts: 250 };

interface CacheEntry {
  products: CatalogProductView[];
  truncated: boolean;
  expiry: number;
}

// Per-isolate cache shared across requests. Reading live keeps the admin picker and the money path
// off the stale projection table while a short TTL bounds upstream API load under traffic spikes
// (each isolate hits the backend at most once per ttl per cache key).
const _cache = new Map<string, CacheEntry>();

export function clearLiveCatalogCache(): void {
  _cache.clear();
}

// Reads the catalog directly from the live commerce backend (Shopify/Woo/Picocart adapters) and
// exposes it through the same CatalogProjectionStorePort the projection uses, so the existing read
// services (storefront list/search/getByRef, purchasable resolution) work unchanged on live data.
// Writes are unsupported — syncing the projection table stays the cron/resync path's job.
export class LiveCachedCatalogStore implements CatalogProjectionStorePort {
  private readonly config: LiveCatalogCacheConfig;

  constructor(
    private readonly backend: BackendCatalogPort,
    private readonly cacheKey: string,
    config: Partial<LiveCatalogCacheConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async all(): Promise<CatalogProductView[]> {
    const hit = _cache.get(this.cacheKey);
    const now = Date.now();
    if (hit && now < hit.expiry) return hit.products;

    const products: CatalogProductView[] = [];
    let truncated = false;
    let cursor: SyncCursor | null = SyncCursor.start();
    while (cursor) {
      const page = await this.backend.listProducts(cursor, this.config.pageSize);
      products.push(...page.products);
      if (products.length >= this.config.maxProducts) {
        truncated = !!page.nextCursor || products.length > this.config.maxProducts;
        break;
      }
      cursor = page.nextCursor;
    }
    const capped = products.slice(0, this.config.maxProducts);
    _cache.set(this.cacheKey, { products: capped, truncated, expiry: now + this.config.ttlMs });
    return capped;
  }

  private async live(): Promise<CatalogProductView[]> {
    return (await this.all()).filter((p) => !p.isTombstoned());
  }

  async listProducts(limit: number, offset: number): Promise<CatalogProjectionListResult> {
    const all = await this.live();
    return { products: all.slice(offset, offset + limit), hasMore: offset + limit < all.length };
  }

  async search(term: string, limit: number): Promise<CatalogProductView[]> {
    const needle = term.trim().toLowerCase();
    const matches = (await this.live()).filter((p) => p.title.toLowerCase().includes(needle));
    return matches.slice(0, limit);
  }

  async findByProductRef(productRef: ExternalRef): Promise<CatalogProductView | null> {
    const ref = productRef.toString();
    return (await this.live()).find((p) => p.externalProductRef.toString() === ref) ?? null;
  }

  async findByVariantRefs(variantRefs: ExternalRef[]): Promise<CatalogProductView[]> {
    const wanted = new Set(variantRefs.map((r) => r.toString()));
    return (await this.all()).filter((p) =>
      p.variants.some((v) => wanted.has(v.externalVariantRef.toString())),
    );
  }

  async distinctCurrencyCodes(scanLimit: number): Promise<string[]> {
    const codes = new Set<string>();
    for (const p of (await this.all()).slice(0, scanLimit)) {
      for (const v of p.variants) {
        const money = v.presentmentPrices.first();
        if (money) codes.add(money.currencyCode.toUpperCase());
      }
    }
    return Array.from(codes);
  }

  async upsertProducts(): Promise<void> {
    throw new Error(READ_ONLY);
  }
  async tombstoneProducts(): Promise<void> {
    throw new Error(READ_ONLY);
  }
  async tombstoneStaleProducts(): Promise<void> {
    throw new Error(READ_ONLY);
  }
}
