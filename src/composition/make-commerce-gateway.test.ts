import { describe, it, expect, vi } from "vitest";
import { assembleCatalogReadPort } from "./make-commerce-gateway";
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
