import type { BackendCatalogPort, BackendCurrencyRates, CatalogPage } from "../../../application/ports/outbound";
import { CatalogProductView } from "../../../domain/catalog-projection";
import { SyncCursor } from "../../../domain/value-objects/sync-cursor";
import { ExternalRef } from "../../../domain/value-objects/external-ref";
import { Market } from "../../../domain/value-objects/market";
import { CapabilityProfile } from "../../../domain/value-objects/capability-profile";
import { BackendError, BackendErrorClass } from "../../../domain/value-objects/backend-error";
import { ShopifyGraphqlClient } from "./shopify-graphql-client";
import { createLogger } from "@/lib/logger";
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

const logger = createLogger("ShopifyCatalogAdapter");

const CURRENCY_RATES_QUERY = `
query CurrencyRates {
  currencyRates { baseCurrency rates { currencyCode rate } currencies }
}`;

interface CurrencyRatesResult {
  currencyRates?: {
    baseCurrency?: unknown;
    rates?: Array<{ currencyCode?: unknown; rate?: unknown }> | null;
    currencies?: unknown;
  } | null;
}

function parseCurrencyRates(data: CurrencyRatesResult | null | undefined): BackendCurrencyRates {
  const node = data?.currencyRates;
  if (!node || typeof node.baseCurrency !== "string" || !node.baseCurrency || !Array.isArray(node.rates)) {
    throw new Error("unexpected currencyRates response shape");
  }
  const rates: Record<string, number> = {};
  for (const r of node.rates) {
    const rate = Number(r?.rate);
    if (typeof r?.currencyCode !== "string" || !Number.isFinite(rate) || rate <= 0) continue;
    rates[r.currencyCode.toUpperCase()] = rate;
  }
  const parsed: BackendCurrencyRates = { baseCurrency: node.baseCurrency.toUpperCase(), rates };
  if (Array.isArray(node.currencies)) {
    parsed.currencies = node.currencies.filter((c): c is string => typeof c === "string" && !!c).map((c) => c.toUpperCase());
  }
  return parsed;
}

interface GraphqlErrorEntry {
  message?: unknown;
  extensions?: { code?: unknown };
}

function graphqlErrors(vendorRaw: unknown): GraphqlErrorEntry[] {
  if (Array.isArray(vendorRaw)) return vendorRaw as GraphqlErrorEntry[];
  const errors = (vendorRaw as { errors?: unknown } | null)?.errors;
  return Array.isArray(errors) ? (errors as GraphqlErrorEntry[]) : [];
}

function isSchemaRejectionEntry(e: GraphqlErrorEntry): boolean {
  const message = typeof e?.message === "string" ? e.message : "";
  return (
    e?.extensions?.code === "undefinedField" ||
    /Field 'currencyRates' doesn't exist/.test(message) ||
    message === "Unsupported operation: CurrencyRates"
  );
}

function isCurrencyRatesSchemaRejection(err: unknown): boolean {
  if (!(err instanceof BackendError) || err.class !== BackendErrorClass.Validation) return false;
  const errors = graphqlErrors(err.vendorRaw);
  return errors.length > 0 && errors.every(isSchemaRejectionEntry);
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

  // picocart extension. Only a schema rejection (real Shopify, or a picocart without the
  // operation) means "no fixed rates"; every other failure, including resolver errors that
  // arrive as a 200 errors body, propagates so an outage is never mistaken for a single-currency store.
  async currencyRates(): Promise<BackendCurrencyRates | null> {
    try {
      return parseCurrencyRates(await this.client.query<CurrencyRatesResult>(CURRENCY_RATES_QUERY, {}));
    } catch (err) {
      if (isCurrencyRatesSchemaRejection(err)) return null;
      logger.warn("currencyRates read failed", { error: err });
      throw err;
    }
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
