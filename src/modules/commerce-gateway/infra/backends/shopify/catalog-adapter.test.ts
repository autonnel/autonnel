import { describe, it, expect, vi } from "vitest";
import { ShopifyCatalogAdapter } from "./catalog-adapter";
import { SyncCursor } from "../../../domain/value-objects/sync-cursor";
import { ShopifyGraphqlClient } from "./shopify-graphql-client";
import { BackendError } from "../../../domain/value-objects/backend-error";

function fakeClient(data: unknown) {
  return { query: vi.fn(async () => data) } as any;
}

const productsResponse = {
  products: {
    pageInfo: { hasNextPage: true, endCursor: "cursor-2" },
    nodes: [
      {
        id: "gid://shopify/Product/1",
        title: "Tee",
        status: "ACTIVE",
        media: { nodes: [{ preview: { image: { url: "https://cdn/img.jpg" } } }] },
        variants: {
          nodes: [
            {
              id: "gid://shopify/ProductVariant/11",
              title: "Default",
              sku: "SKU1",
              inventoryQuantity: 5,
              inventoryPolicy: "DENY",
              contextualPricing: {
                price: { amount: "19.99", currencyCode: "USD" },
                compareAtPrice: { amount: "24.99", currencyCode: "USD" },
              },
            },
          ],
        },
      },
    ],
  },
};

describe("ShopifyCatalogAdapter", () => {
  it("maps products + variants + presentment prices + inventory into the read-model", async () => {
    const adapter = new ShopifyCatalogAdapter(fakeClient(productsResponse), "US");
    const page = await adapter.listProducts(SyncCursor.start(), 50);

    expect(page.nextCursor?.value).toBe("cursor-2");
    expect(page.products).toHaveLength(1);
    const product = page.products[0];
    expect(product.externalProductRef.toString()).toBe("gid://shopify/Product/1");
    expect(product.mediaRefs).toEqual(["https://cdn/img.jpg"]);

    const variant = product.variants[0];
    expect(variant.externalVariantRef.toString()).toBe("gid://shopify/ProductVariant/11");
    const usMarket = (await import("../../../domain/value-objects/market")).Market.of("US", "USD");
    expect(variant.presentmentPrices.resolve(usMarket)?.amountMinor).toBe(1999);
    expect(variant.presentmentPrices.resolveCompare(usMarket)?.amountMinor).toBe(2499);
    expect(variant.inventory.available).toBe(5);
    expect(variant.inventory.policy).toBe("deny");
  });

  it("treats untracked inventory as continue-policy so quantity 0 stays sellable", async () => {
    const untracked = JSON.parse(JSON.stringify(productsResponse));
    const v = untracked.products.nodes[0].variants.nodes[0];
    v.inventoryQuantity = 0;
    v.inventoryPolicy = "DENY";
    v.inventoryItem = { tracked: false };
    const adapter = new ShopifyCatalogAdapter(fakeClient(untracked), "US");
    const page = await adapter.listProducts(SyncCursor.start(), 50);
    const variant = page.products[0].variants[0];
    expect(variant.inventory.available).toBe(0);
    expect(variant.inventory.policy).toBe("continue");
  });

  it("returns null cursor on the last page", async () => {
    const lastPage = JSON.parse(JSON.stringify(productsResponse));
    lastPage.products.pageInfo = { hasNextPage: false, endCursor: null };
    const adapter = new ShopifyCatalogAdapter(fakeClient(lastPage), "US");
    const page = await adapter.listProducts(SyncCursor.start(), 50);
    expect(page.nextCursor).toBeNull();
  });

  it("describes Shopify capabilities (presentment + external paid order + webhooks)", () => {
    const adapter = new ShopifyCatalogAdapter(fakeClient({}), "US");
    const profile = adapter.describeCapabilities();
    expect(profile.supportsExternalPaidOrder).toBe(true);
    expect(profile.handoffStrategy).toBe("orderCreate");
  });

  it("reads fixed currency rates from the backend", async () => {
    const client = fakeClient({
      currencyRates: {
        baseCurrency: "USD",
        rates: [
          { currencyCode: "EUR", rate: 0.9, rounding: "none" },
          { currencyCode: "jpy", rate: "150", rounding: "integer" },
          { currencyCode: "GBP", rate: 0 },
        ],
      },
    });
    const adapter = new ShopifyCatalogAdapter(client, "US");
    expect(await adapter.currencyRates()).toEqual({ baseCurrency: "USD", rates: { EUR: 0.9, JPY: 150 } });
    expect(client.query.mock.calls[0][0]).toContain("currencyRates");
  });

  it("reads the enabled currency list when the backend returns one", async () => {
    const client = fakeClient({
      currencyRates: { baseCurrency: "USD", rates: [{ currencyCode: "EUR", rate: 0.9 }], currencies: ["USD", "eur", "GBP", 7] },
    });
    const adapter = new ShopifyCatalogAdapter(client, "US");
    expect(await adapter.currencyRates()).toEqual({ baseCurrency: "USD", rates: { EUR: 0.9 }, currencies: ["USD", "EUR", "GBP"] });
    expect(client.query.mock.calls[0][0]).toContain("currencies");
  });

  it("returns null when the backend rejects the currencyRates field (real Shopify)", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      errors: [{ message: "Field 'currencyRates' doesn't exist on type 'QueryRoot'", extensions: { code: "undefinedField" } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new ShopifyGraphqlClient({ shopDomain: "s.myshopify.com", accessToken: "t", apiVersion: "2025-01" }, fetchFn);
    expect(await new ShopifyCatalogAdapter(client, "US").currencyRates()).toBeNull();
  });

  it("rethrows transport and 5xx failures instead of reporting no rates", async () => {
    const down = new ShopifyGraphqlClient({ shopDomain: "s", accessToken: "t", apiVersion: "v" }, vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(new ShopifyCatalogAdapter(down, "US").currencyRates()).rejects.toBeInstanceOf(BackendError);
    const failing = new ShopifyGraphqlClient({ shopDomain: "s", accessToken: "t", apiVersion: "v" }, vi.fn(async () => new Response("{}", { status: 503 })));
    await expect(new ShopifyCatalogAdapter(failing, "US").currencyRates()).rejects.toBeInstanceOf(BackendError);
    const unauthorized = new ShopifyGraphqlClient({ shopDomain: "s", accessToken: "t", apiVersion: "v" }, vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(new ShopifyCatalogAdapter(unauthorized, "US").currencyRates()).rejects.toBeInstanceOf(BackendError);
  });

  it("treats an unexpected rates shape as a failed read", async () => {
    for (const data of [{}, { currencyRates: null }, { currencyRates: { rates: [] } }, { currencyRates: { baseCurrency: "USD", rates: null } }]) {
      await expect(new ShopifyCatalogAdapter(fakeClient(data), "US").currencyRates()).rejects.toThrow(/unexpected currencyRates/);
    }
  });

  it("returns null for picocart versions without the CurrencyRates operation", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "Unsupported operation: CurrencyRates" }] }), { status: 200 }));
    const client = new ShopifyGraphqlClient({ shopDomain: "s", accessToken: "t", apiVersion: "v" }, fetchFn);
    expect(await new ShopifyCatalogAdapter(client, "US").currencyRates()).toBeNull();
  });

  it("recognises Shopify's field-not-found message without an extensions code", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "Field 'currencyRates' doesn't exist on type 'QueryRoot'" }] }), { status: 200 }));
    const client = new ShopifyGraphqlClient({ shopDomain: "s", accessToken: "t", apiVersion: "v" }, fetchFn);
    expect(await new ShopifyCatalogAdapter(client, "US").currencyRates()).toBeNull();
  });

  it("rethrows when a schema rejection comes with other errors", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "x", extensions: { code: "undefinedField" } }, { message: "db down" }] }), { status: 200 }));
    const client = new ShopifyGraphqlClient({ shopDomain: "s", accessToken: "t", apiVersion: "v" }, fetchFn);
    await expect(new ShopifyCatalogAdapter(client, "US").currencyRates()).rejects.toBeInstanceOf(BackendError);
  });

  it("rethrows resolver failures reported as a 200 errors body", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "db down" }] }), { status: 200 }));
    const client = new ShopifyGraphqlClient({ shopDomain: "s", accessToken: "t", apiVersion: "v" }, fetchFn);
    await expect(new ShopifyCatalogAdapter(client, "US").currencyRates()).rejects.toBeInstanceOf(BackendError);
  });
});
