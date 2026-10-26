import { describe, it, expect, vi } from "vitest";
import { assembleCatalogReadPort, createCurrencyRatesReader } from "./make-commerce-gateway";
import { CatalogProductView, CatalogVariantView } from "@/modules/commerce-gateway/domain/catalog-projection";
import { ExternalRef } from "@/modules/commerce-gateway/domain/value-objects/external-ref";
import { Market } from "@/modules/commerce-gateway/domain/value-objects/market";
import { PresentmentPriceMap } from "@/modules/commerce-gateway/domain/value-objects/presentment-price";
import { InventorySnapshot } from "@/modules/commerce-gateway/domain/value-objects/inventory-snapshot";
import { Money } from "@/modules/shared-kernel/money";

describe("assembleCatalogReadPort", () => {
  it("wires the read services into a working CatalogReadPort", async () => {
    const product = CatalogProductView.create({
      backendKind: "shopify",
      externalProductRef: ExternalRef.of("gid://p/1"),
      title: "Tee",
      status: "active",
      mediaRefs: [],
      variants: [
        CatalogVariantView.create({
          externalVariantRef: ExternalRef.of("gid://v/1"),
          title: "Default",
          presentmentPrices: PresentmentPriceMap.from([
            { market: Market.of("US", "USD"), price: Money.of(1999, "USD") },
          ]),
          inventory: InventorySnapshot.of(5, "deny", new Date()),
        }),
      ],
    });
    const store = {
      findByVariantRefs: vi.fn(async () => [product]),
      search: vi.fn(async () => [product]),
      upsertProducts: vi.fn(),
      tombstoneProducts: vi.fn(),
    };
    const backendCatalog = {
      describeCapabilities: () => product && (require("@/modules/commerce-gateway/domain/value-objects/capability-profile").CapabilityProfile.of({
        supportsPresentmentPricing: true,
        supportsRealtimeInventory: true,
        supportsExternalPaidOrder: true,
        supportsWebhooks: true,
        handoffStrategy: "orderCreate",
      })),
    };

    const port = assembleCatalogReadPort({ store: store as any, backendCatalog: backendCatalog as any });
    const result = await port.resolvePurchasables({ variantRefs: [ExternalRef.of("gid://v/1")], market: Market.of("US", "USD") });
    expect(result[0].price?.amountMinor).toBe(1999);
  });
});

describe("createCurrencyRatesReader", () => {
  const rates = { baseCurrency: "USD", rates: { EUR: 0.9 } };

  it("caches rates per tenant for the TTL", async () => {
    let now = 0;
    const load = vi.fn(async () => rates);
    const read = createCurrencyRatesReader(load, 60_000, () => now);
    expect(await read("t1")).toEqual(rates);
    expect(await read("t1")).toEqual(rates);
    expect(load).toHaveBeenCalledTimes(1);
    await read("t2");
    expect(load).toHaveBeenCalledTimes(2);
    now = 60_001;
    await read("t1");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("caches a null answer (backend without rates)", async () => {
    const load = vi.fn(async () => null);
    const read = createCurrencyRatesReader(load, 60_000, () => 0);
    expect(await read("t1")).toBeNull();
    expect(await read("t1")).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("propagates load failures without caching them", async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("backend down"))
      .mockResolvedValueOnce(rates);
    const read = createCurrencyRatesReader(load, 60_000, () => 0);
    await expect(read("t1")).rejects.toThrow("backend down");
    expect(await read("t1")).toEqual(rates);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("evicts expired entries of other tenants on lookup", async () => {
    let now = 0;
    const cache = new Map();
    const read = createCurrencyRatesReader(async () => rates, 60_000, () => now, cache);
    await read("t1");
    await read("t2");
    now = 60_001;
    await read("t3");
    expect([...cache.keys()]).toEqual(["t3"]);
  });
});
