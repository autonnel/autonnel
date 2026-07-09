import type { BackendCredentialsPort, BackendCredentials } from "../../application/ports/outbound";

type GetConfigFn = (key: string) => Promise<any>;

// picocart speaks the Shopify Admin GraphQL subset, so it routes through the shopify backend.
// The ShopifyGraphqlClient builds `https://{shopDomain}/admin/api/{ver}/graphql.json`, so shopDomain
// must be a bare host[:port][/path] without protocol or trailing slash.
function picocartShopDomain(baseUrl: string): string {
  let host = baseUrl.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return host;
}

export class AppConfigBackendCredentials implements BackendCredentialsPort {
  constructor(private readonly getConfig: GetConfigFn = defaultGetConfig) {}

  async load(): Promise<BackendCredentials | null> {
    const cfg = await this.getConfig("ecommerce.config");
    if (!cfg || !cfg.credentials) return null;
    const provider = normalizeProvider(cfg.provider);
    const c = cfg.credentials;
    const isActive = cfg.isActive ?? false;

    if (provider === "picocart") {
      return {
        backendKind: "shopify",
        shopDomain: picocartShopDomain(String(c.baseUrl ?? "")),
        accessToken: String(c.apiKey ?? ""),
        disableNotifications: true,
        isActive,
        apiVersion: typeof c.apiVersion === "string" ? c.apiVersion : undefined,
      };
    }

    if (provider === "woocommerce") {
      return {
        backendKind: "woocommerce",
        accessToken: "",
        siteUrl: typeof c.siteUrl === "string" ? c.siteUrl : undefined,
        consumerKey: typeof c.consumerKey === "string" ? c.consumerKey : undefined,
        consumerSecret: typeof c.consumerSecret === "string" ? c.consumerSecret : undefined,
        apiVersion: typeof c.apiVersion === "string" ? c.apiVersion : undefined,
        disableNotifications: true,
        isActive,
      };
    }

    return {
      backendKind: "shopify",
      shopDomain: c.shopDomain,
      accessToken: c.accessToken,
      disableNotifications: c.disableNotifications ?? true,
      isActive,
      apiVersion: typeof c.apiVersion === "string" ? c.apiVersion : undefined,
    };
  }
}

function normalizeProvider(value: unknown): "shopify" | "woocommerce" | "picocart" {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "woocommerce") return "woocommerce";
  if (v === "picocart") return "picocart";
  return "shopify";
}

async function defaultGetConfig(key: string): Promise<any> {
  const { getConfig } = await import("@/lib/config/get-config");
  return getConfig(key);
}
