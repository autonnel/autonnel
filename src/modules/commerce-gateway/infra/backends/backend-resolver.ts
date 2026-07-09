import type { BackendCatalogPort, BackendOrderPort, BackendFulfillmentReaderPort, BackendCredentials } from "../../application/ports/outbound";
import { ShopifyGraphqlClient } from "./shopify/shopify-graphql-client";
import { ShopifyCatalogAdapter } from "./shopify/catalog-adapter";
import { ShopifyOrderAdapter } from "./shopify/order-adapter";
import { ShopifyFulfillmentAdapter } from "./shopify/fulfillment-adapter";
import { WooRestClient } from "./woocommerce/woo-rest-client";
import { WooCommerceCatalogAdapter } from "./woocommerce/catalog-adapter";
import { WooCommerceOrderAdapter } from "./woocommerce/order-adapter";
import { WooCommerceFulfillmentAdapter } from "./woocommerce/fulfillment-adapter";
import { readEnv } from "@/lib/runtime/env";

const SHOPIFY_API_VERSION = "2024-01";
const DEFAULT_COUNTRY = "US";
const DEFAULT_CURRENCY = "USD";

export interface BackendAdapters {
  catalog: BackendCatalogPort;
  order: BackendOrderPort;
  fulfillment: BackendFulfillmentReaderPort;
}

export function resolveBackendAdapters(kind: string, creds: BackendCredentials, country = DEFAULT_COUNTRY): BackendAdapters {
  // picocart speaks the Shopify Admin GraphQL subset, so it routes through the shopify backend.
  if (kind === "shopify" || kind === "picocart") {
    const client = new ShopifyGraphqlClient({
      shopDomain: creds.shopDomain!,
      accessToken: creds.accessToken,
      apiVersion: creds.apiVersion || SHOPIFY_API_VERSION,
    });
    return {
      catalog: new ShopifyCatalogAdapter(client, country),
      order: new ShopifyOrderAdapter(client, { disableNotifications: creds.disableNotifications }),
      fulfillment: new ShopifyFulfillmentAdapter(client),
    };
  }

  if (kind === "woocommerce") {
    const client = new WooRestClient({
      siteUrl: creds.siteUrl!,
      consumerKey: creds.consumerKey!,
      consumerSecret: creds.consumerSecret!,
      apiVersion: creds.apiVersion,
    });
    const currency = readEnv("DEFAULT_CURRENCY") || DEFAULT_CURRENCY;
    return {
      catalog: new WooCommerceCatalogAdapter(client, currency),
      order: new WooCommerceOrderAdapter(client),
      fulfillment: new WooCommerceFulfillmentAdapter(client),
    };
  }

  throw new Error(`unsupported backend: ${kind}`);
}
