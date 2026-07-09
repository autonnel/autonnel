import { describe, it, expect, vi } from "vitest";
import { WooCommerceCatalogAdapter } from "./catalog-adapter";
import { SyncCursor } from "../../../domain/value-objects/sync-cursor";
import { Market } from "../../../domain/value-objects/market";

function fakeClient(byPath: Record<string, unknown>) {
  return {
    request: vi.fn(async (_method: string, path: string) => {
      for (const key of Object.keys(byPath)) {
        if (path.startsWith(key)) return byPath[key];
      }
      throw new Error(`unexpected path: ${path}`);
    }),
  } as any;
}

const variableProduct = {
  id: 100,
  name: "Tee",
  status: "publish",
  images: [{ src: "https://cdn/tee.jpg" }],
  variations: [201, 202],
};

const variations = [
  {
    id: 201,
    sku: "TEE-S",
    price: "19.99",
    regular_price: "24.99",
    sale_price: "19.99",
    manage_stock: true,
    stock_quantity: 5,
    attributes: [{ name: "Size", option: "S" }],
  },
  {
    id: 202,
    sku: "TEE-L",
    price: "21.50",
    manage_stock: false,
    stock_quantity: null,
    attributes: [{ name: "Size", option: "L" }],
  },
];

describe("WooCommerceCatalogAdapter", () => {
  it("maps a variable woo product into the read-model with single-market presentment prices", async () => {
    const client = fakeClient({
      "/products/100/variations": variations,
      "/products": [variableProduct],
    });
    const adapter = new WooCommerceCatalogAdapter(client, "USD");
    const page = await adapter.listProducts(SyncCursor.start(), 50);

    expect(page.products).toHaveLength(1);
    const product = page.products[0];
    expect(product.backendKind).toBe("woocommerce");
    expect(product.externalProductRef.toString()).toBe("100");
    expect(product.title).toBe("Tee");
    expect(product.status).toBe("active");
    expect(product.mediaRefs).toEqual(["https://cdn/tee.jpg"]);
    expect(product.variants).toHaveLength(2);

    const small = product.variants[0];
    expect(small.externalVariantRef.toString()).toBe("201");
    expect(small.title).toBe("S");
    expect(small.sku).toBe("TEE-S");
    expect(small.presentmentPrices.resolve(Market.of("US", "USD"))?.amountMinor).toBe(1999);
    expect(small.presentmentPrices.resolveCompare(Market.of("US", "USD"))?.amountMinor).toBe(2499);
    expect(small.inventory.available).toBe(5);
    expect(small.inventory.policy).toBe("deny");

    const large = product.variants[1];
    expect(large.presentmentPrices.resolve(Market.of("US", "USD"))?.amountMinor).toBe(2150);
    // No regular_price above sale -> no compare-at.
    expect(large.presentmentPrices.resolveCompare(Market.of("US", "USD"))).toBeUndefined();
    expect(large.inventory.available).toBeNull();
    expect(large.inventory.policy).toBe("continue");
  });

  it("exposes a simple product as a single Default variant keyed by the product id", async () => {
    const client = fakeClient({
      "/products": [{ id: 7, name: "Mug", status: "publish", sku: "MUG", price: "9.00", manage_stock: true, stock_quantity: 3 }],
    });
    const adapter = new WooCommerceCatalogAdapter(client, "USD");
    const page = await adapter.listProducts(SyncCursor.start(), 50);
    const product = page.products[0];
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0].externalVariantRef.toString()).toBe("7");
    expect(product.variants[0].title).toBe("Default");
    expect(product.variants[0].presentmentPrices.resolve(Market.of("US", "USD"))?.amountMinor).toBe(900);
  });

  it("advances the page cursor when a full page is returned and stops on a short page", async () => {
    const full = Array.from({ length: 2 }, (_, i) => ({ id: i + 1, name: `P${i}`, status: "publish", price: "1.00" }));
    const adapter = new WooCommerceCatalogAdapter(fakeClient({ "/products": full }), "USD");
    const page = await adapter.listProducts(SyncCursor.start(), 2);
    expect(page.nextCursor?.value).toBe("2");

    const shortAdapter = new WooCommerceCatalogAdapter(fakeClient({ "/products": [full[0]] }), "USD");
    const shortPage = await shortAdapter.listProducts(SyncCursor.start(), 2);
    expect(shortPage.nextCursor).toBeNull();
  });

  it("describes woo capabilities (single-currency, external paid order, no webhooks)", () => {
    const adapter = new WooCommerceCatalogAdapter(fakeClient({}), "USD");
    const profile = adapter.describeCapabilities();
    expect(profile.supportsExternalPaidOrder).toBe(true);
    expect(profile.supportsWebhooks).toBe(false);
    expect(profile.handoffStrategy).toBe("orderCreate");
  });
});
