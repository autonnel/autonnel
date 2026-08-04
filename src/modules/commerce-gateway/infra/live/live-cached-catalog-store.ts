import type {
  BackendCatalogPort,
  CatalogProjectionStorePort,
  CatalogProjectionListResult,
} from "../../application/ports/outbound";
import { CatalogProductView } from "../../domain/catalog-projection";
import { getCache } from "../../../../lib/adapters/cache";
import { encodeProduct, decodeProduct, type SerializedProduct } from "./catalog-view-codec";
import { SyncCursor } from "../../domain/value-objects/sync-cursor";
import { ExternalRef } from "../../domain/value-objects/external-ref";

const READ_ONLY = "LiveCachedCatalogStore is read-only (live backend reads only)";

export interface LiveCatalogCacheConfig {
  ttlMs: number;
  pageSize: number;
  maxProducts: number;
}

const DEFAULT_CONFIG: LiveCatalogCacheConfig = { ttlMs: 300_000, pageSize: 100, maxProducts: 250 };

interface CacheEntry {
  products: CatalogProductView[];
  truncated: boolean;
  expiry: number;
}

interface SharedCacheEntry {
  products: SerializedProduct[];
  truncated: boolean;
}

const SHARED_PREFIX = 'catalog:live:';

// Two tiers. The in-process Map is a per-isolate hot path; the SHARED cache (Cloudflare KV in
// production) is what actually bounds upstream load, because on workerd isolates are short-lived
// and numerous so an in-process cache is almost always cold — every request used to pay a full
// catalog fetch. Reading live still keeps the admin picker and the money path off the stale
// projection table.
const _cache = new Map<string, CacheEntry>();

// Clears BOTH tiers. Clearing only the in-process map would leave the shared entry serving stale
// data to the next reader (and, in tests, leak state between cases).
export async function clearLiveCatalogCache(): Promise<void> {
  _cache.clear();
  try {
    await getCache().deletePattern(`${SHARED_PREFIX}*`);
  } catch {
    // best effort: the TTL still bounds staleness
  }
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

  private memoize(products: CatalogProductView[], truncated: boolean): CatalogProductView[] {
    _cache.set(this.cacheKey, { products, truncated, expiry: Date.now() + this.config.ttlMs });
    return products;
  }

  private async all(): Promise<CatalogProductView[]> {
    const hit = _cache.get(this.cacheKey);
    const now = Date.now();
    if (hit && now < hit.expiry) return hit.products;

    // Shared tier: on workerd this is the only cache that survives between isolates.
    const sharedKey = SHARED_PREFIX + this.cacheKey;
    try {
      const shared = await getCache().get<SharedCacheEntry>(sharedKey);
      if (shared) return this.memoize(shared.products.map(decodeProduct), shared.truncated);
    } catch {
      // A cache outage must never take the catalog down; fall through to the backend.
    }

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
    try {
      await getCache().set<SharedCacheEntry>(
        SHARED_PREFIX + this.cacheKey,
        { products: capped.map(encodeProduct), truncated },
        Math.ceil(this.config.ttlMs / 1000),
      );
    } catch {
      // Best effort: failing to publish to the shared cache only costs the next isolate a refetch.
    }
    return this.memoize(capped, truncated);
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
