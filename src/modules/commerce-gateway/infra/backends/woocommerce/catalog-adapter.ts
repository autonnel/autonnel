import type { BackendCatalogPort, CatalogPage } from "../../../application/ports/outbound";
import { CatalogProductView } from "../../../domain/catalog-projection";
import { SyncCursor } from "../../../domain/value-objects/sync-cursor";
import { ExternalRef } from "../../../domain/value-objects/external-ref";
import { Market } from "../../../domain/value-objects/market";
import { CapabilityProfile } from "../../../domain/value-objects/capability-profile";
import { createLogger } from "@/lib/logger";
import { WooRestClient } from "./woo-rest-client";
import { mapProduct, type WooProduct, type WooVariation } from "./woo-mappers";

const logger = createLogger("WooCatalogAdapter");

export class WooCommerceCatalogAdapter implements BackendCatalogPort {
  constructor(
    private readonly client: WooRestClient,
    private readonly currency: string,
  ) {}

  async listProducts(cursor: SyncCursor, pageSize: number): Promise<CatalogPage> {
    const page = cursor.isStart() ? 1 : Math.max(1, parseInt(cursor.value ?? "1", 10) || 1);
    const perPage = Math.min(pageSize, 100);
    const products = await this.client.request<WooProduct[]>("GET", "/products", {
      query: { per_page: perPage, page, status: "publish" },
    });
    const now = new Date();
    const views = await Promise.all(products.map((p) => this.toView(p, now)));
    const hasNextPage = products.length === perPage;
    return {
      products: views,
      nextCursor: hasNextPage ? SyncCursor.of(String(page + 1)) : null,
    };
  }

  async getProduct(productRef: ExternalRef): Promise<CatalogProductView | null> {
    try {
      const product = await this.client.request<WooProduct>(
        "GET",
        `/products/${encodeURIComponent(productRef.toString())}`,
      );
      return this.toView(product, new Date());
    } catch (error) {
      logger.warn("getProduct failed", { productRef: productRef.toString(), error });
      return null;
    }
  }

  async getVariants(productRef: ExternalRef): Promise<CatalogProductView | null> {
    return this.getProduct(productRef);
  }

  async contextualPrices(productRef: ExternalRef, _market: Market): Promise<CatalogProductView | null> {
    return this.getProduct(productRef);
  }

  async getInventory(variantRefs: ExternalRef[]): Promise<Map<string, number | null>> {
    // Woo has no variant-by-id endpoint; reliable stock lookup needs the parent product context that a
    // bare variant ref does not carry. Inventory is surfaced via the catalog projection instead.
    const map = new Map<string, number | null>();
    for (const ref of variantRefs) map.set(ref.toString(), null);
    return map;
  }

  describeCapabilities(): CapabilityProfile {
    return CapabilityProfile.of({
      supportsPresentmentPricing: false,
      supportsRealtimeInventory: false,
      supportsExternalPaidOrder: true,
      supportsWebhooks: false,
      handoffStrategy: "orderCreate",
    });
  }

  private async toView(product: WooProduct, now: Date): Promise<CatalogProductView> {
    const variations =
      product.variations && product.variations.length > 0
        ? await this.fetchVariations(product.id)
        : [];
    return mapProduct(product, variations, this.currency, now);
  }

  private async fetchVariations(productId: number | string): Promise<WooVariation[]> {
    try {
      return await this.client.request<WooVariation[]>(
        "GET",
        `/products/${encodeURIComponent(String(productId))}/variations`,
        { query: { per_page: 100 } },
      );
    } catch (error) {
      logger.warn("fetchVariations failed", { productId, error });
      return [];
    }
  }
}
