import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ShopRegionListDto } from "@/contracts/shop";

const availableCurrencies = vi.fn();
const describeCapabilities = vi.fn();
const makeReadSide = vi.fn();

vi.mock("@/composition/make-commerce-gateway", () => ({
  makeLiveStorefrontCatalogReadSide: () => Promise.resolve({ availableCurrencies }),
  makeCommerceGatewayReadSide: () => makeReadSide(),
}));

import { GET } from "./regions";

async function call(): Promise<ShopRegionListDto> {
  const request = new Request("https://shop.test/api/shop/regions");
  const res = await (GET as any)({ request, params: {}, locals: {} });
  return res.json();
}

beforeEach(() => {
  availableCurrencies.mockReset();
  describeCapabilities.mockReset();
  makeReadSide.mockReset();
  makeReadSide.mockResolvedValue({ describeCapabilities });
});

describe("GET /api/shop/regions", () => {
  it("derives currency-keyed regions from the default plus catalog currencies", async () => {
    availableCurrencies.mockResolvedValue(["EUR"]);
    describeCapabilities.mockRejectedValue(new Error("no backend"));
    const body = await call();
    const ids = body.regions.map((r) => r.id);
    expect(ids).toContain("USD");
    expect(ids).toContain("EUR");
    expect(body.regions[0]).toMatchObject({ id: "USD", currencyCode: "USD", countries: [] });
    expect(body.supportsMultiCurrency).toBe(true);
  });

  it("falls back to the default currency only when the catalog is empty", async () => {
    availableCurrencies.mockResolvedValue([]);
    describeCapabilities.mockRejectedValue(new Error("no backend"));
    const body = await call();
    expect(body.regions).toHaveLength(1);
    expect(body.regions[0].currencyCode).toBe("USD");
    expect(body.supportsMultiCurrency).toBe(false);
  });

  it("prefers backend capability flags for supportsMultiCurrency when available", async () => {
    availableCurrencies.mockResolvedValue([]);
    describeCapabilities.mockResolvedValue({ upstreamFlags: () => ({ supportsMultiCurrency: true }) });
    const body = await call();
    expect(body.supportsMultiCurrency).toBe(true);
  });
});
