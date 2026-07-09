import { describe, it, expect, vi } from "vitest";
import { ShopifyCatalogAdapter } from "./catalog-adapter";
import { SyncCursor } from "../../../domain/value-objects/sync-cursor";

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
});
