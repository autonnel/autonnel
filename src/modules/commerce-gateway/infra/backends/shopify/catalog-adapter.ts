import type { BackendCatalogPort, CatalogPage } from "../../../application/ports/outbound";
import { CatalogProductView } from "../../../domain/catalog-projection";
import { SyncCursor } from "../../../domain/value-objects/sync-cursor";
import { ExternalRef } from "../../../domain/value-objects/external-ref";
import { Market } from "../../../domain/value-objects/market";
import { CapabilityProfile } from "../../../domain/value-objects/capability-profile";
import { ShopifyGraphqlClient } from "./shopify-graphql-client";
import { mapProduct, type ShopifyProductNode } from "./shopify-mappers";

const PRODUCTS_QUERY = `
query Products($cursor: String, $pageSize: Int!, $country: CountryCode!) {
  products(first: $pageSize, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title status
      media(first: 5) { nodes { preview { image { url } } } }
      variants(first: 100) {
        nodes {
          id title sku inventoryQuantity inventoryPolicy
          inventoryItem { tracked }
          contextualPricing(context: { country: $country }) {
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
          }
        }
      }
    }
  }
}`;

interface ProductsResult {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ShopifyProductNode[];
  };
}

export class ShopifyCatalogAdapter implements BackendCatalogPort {
  constructor(
    private readonly client: ShopifyGraphqlClient,
    private readonly defaultCountry: string,
  ) {}

  async listProducts(cursor: SyncCursor, pageSize: number): Promise<CatalogPage> {
    const data = await this.client.query<ProductsResult>(PRODUCTS_QUERY, {
      cursor: cursor.isStart() ? null : cursor.value,
      pageSize,
      country: this.defaultCountry,
    });
    const now = new Date();
    return {
      products: data.products.nodes.map((n) => mapProduct(n, this.defaultCountry, now)),
      nextCursor: data.products.pageInfo.hasNextPage && data.products.pageInfo.endCursor
        ? SyncCursor.of(data.products.pageInfo.endCursor)
        : null,
    };
  }

  async getProduct(productRef: ExternalRef): Promise<CatalogProductView | null> {
    const page = await this.listProducts(SyncCursor.start(), 50);
    return page.products.find((p) => p.externalProductRef.equals(productRef)) ?? null;
  }

  async getVariants(productRef: ExternalRef): Promise<CatalogProductView | null> {
    return this.getProduct(productRef);
  }

  async contextualPrices(productRef: ExternalRef, _market: Market): Promise<CatalogProductView | null> {
    return this.getProduct(productRef);
  }

  async getInventory(variantRefs: ExternalRef[]): Promise<Map<string, number | null>> {
    const map = new Map<string, number | null>();
    for (const ref of variantRefs) map.set(ref.toString(), null);
    return map;
  }

  describeCapabilities(): CapabilityProfile {
    return CapabilityProfile.of({
      supportsPresentmentPricing: true,
      supportsRealtimeInventory: true,
      supportsExternalPaidOrder: true,
      supportsWebhooks: true,
      handoffStrategy: "orderCreate",
    });
  }
}
