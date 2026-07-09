import { describe, it, expect, vi } from "vitest";
import { AppConfigBackendCredentials } from "./backend-credentials";
import { resolveBackendAdapters } from "./backend-resolver";
import { ShopifyCatalogAdapter } from "./shopify/catalog-adapter";
import { WooCommerceCatalogAdapter } from "./woocommerce/catalog-adapter";

describe("AppConfigBackendCredentials", () => {
  it("maps ecommerce.config shopify slot to BackendCredentials", async () => {
    const getConfig = vi.fn(async () => ({
      provider: "shopify",
      isActive: true,
      fulfillmentMode: "merged",
      credentials: {
        shopDomain: "s.myshopify.com",
        accessToken: "tok",
        disableNotifications: true,
      },
    }));
    const creds = new AppConfigBackendCredentials(getConfig as any);
    const loaded = await creds.load();
    expect(loaded).toMatchObject({
      backendKind: "shopify",
      shopDomain: "s.myshopify.com",
      accessToken: "tok",
      disableNotifications: true,
      isActive: true,
    });
  });

  it("maps picocart config to shopify-shaped creds (baseUrl protocol stripped, apiKey as token)", async () => {
    const getConfig = vi.fn(async () => ({
      provider: "picocart",
      isActive: true,
      credentials: { baseUrl: "https://shop.picocart.dev/", apiKey: "pk_live_123" },
    }));
    const loaded = await new AppConfigBackendCredentials(getConfig as any).load();
    expect(loaded).toMatchObject({
      backendKind: "shopify",
      shopDomain: "shop.picocart.dev",
      accessToken: "pk_live_123",
      disableNotifications: true,
      isActive: true,
    });
  });

  it("maps woocommerce config to woo-shaped creds", async () => {
    const getConfig = vi.fn(async () => ({
      provider: "woocommerce",
      isActive: true,
      credentials: {
        siteUrl: "https://store.example.com",
        consumerKey: "ck_abc",
        consumerSecret: "cs_xyz",
      },
    }));
    const loaded = await new AppConfigBackendCredentials(getConfig as any).load();
    expect(loaded).toMatchObject({
      backendKind: "woocommerce",
      siteUrl: "https://store.example.com",
      consumerKey: "ck_abc",
      consumerSecret: "cs_xyz",
      isActive: true,
    });
  });

  it("returns null when ecommerce.config is unset", async () => {
    const creds = new AppConfigBackendCredentials(vi.fn(async () => null) as any);
    expect(await creds.load()).toBeNull();
  });
});

describe("resolveBackendAdapters", () => {
  it("routes shopify to the Shopify adapters", () => {
    const adapters = resolveBackendAdapters("shopify", {
      backendKind: "shopify",
      shopDomain: "s.myshopify.com",
      accessToken: "tok",
      disableNotifications: true,
      isActive: true,
    } as any);
    expect(adapters.catalog).toBeInstanceOf(ShopifyCatalogAdapter);
  });

  it("routes picocart to the Shopify adapters pointed at the picocart URL", () => {
    const adapters = resolveBackendAdapters("picocart", {
      backendKind: "shopify",
      shopDomain: "shop.picocart.dev",
      accessToken: "pk_live_123",
      disableNotifications: true,
      isActive: true,
    } as any);
    expect(adapters.catalog).toBeInstanceOf(ShopifyCatalogAdapter);
  });

  it("routes woocommerce to the WooCommerce adapters", () => {
    const adapters = resolveBackendAdapters("woocommerce", {
      backendKind: "woocommerce",
      accessToken: "",
      siteUrl: "https://store.example.com",
      consumerKey: "ck_abc",
      consumerSecret: "cs_xyz",
      disableNotifications: true,
      isActive: true,
    } as any);
    expect(adapters.catalog).toBeInstanceOf(WooCommerceCatalogAdapter);
  });

  it("throws for genuinely unknown backends", () => {
    expect(() => resolveBackendAdapters("magento", { accessToken: "t" } as any)).toThrow(/unsupported/i);
  });
});
