import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ShopRegionListDto } from "@/contracts/shop";

const availableCurrencies = vi.fn();
const describeCapabilities = vi.fn();
const makeReadSide = vi.fn();
const readCurrencyRates = vi.fn();

vi.mock("@/composition/make-commerce-gateway", () => ({
  makeLiveStorefrontCatalogReadSide: () => Promise.resolve({ availableCurrencies }),
  makeCommerceGatewayReadSide: () => makeReadSide(),
  readCurrencyRates: () => readCurrencyRates(),
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
  readCurrencyRates.mockReset();
  readCurrencyRates.mockResolvedValue(null);
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

  it("lists the backend base currency plus every currency it has a rate for", async () => {
    availableCurrencies.mockResolvedValue(["USD"]);
    describeCapabilities.mockRejectedValue(new Error("no backend"));
    readCurrencyRates.mockResolvedValue({ baseCurrency: "USD", rates: { EUR: 0.95, GBP: 0.8 } });
    const body = await call();
    expect(body.regions.map((r) => r.id)).toEqual(["USD", "EUR", "GBP"]);
    expect(availableCurrencies).not.toHaveBeenCalled();
    expect(body.supportsMultiCurrency).toBe(true);
  });

  it("keeps the catalog-derived list when the rates read fails", async () => {
    availableCurrencies.mockResolvedValue(["EUR"]);
    describeCapabilities.mockRejectedValue(new Error("no backend"));
    readCurrencyRates.mockRejectedValue(new Error("upstream down"));
    const body = await call();
    expect(body.regions.map((r) => r.id)).toEqual(["USD", "EUR"]);
  });

  it("always includes the store default currency next to the backend rate currencies", async () => {
    describeCapabilities.mockRejectedValue(new Error("no backend"));
    readCurrencyRates.mockResolvedValue({ baseCurrency: "EUR", rates: { GBP: 0.85, USD: 1.1 } });
    const body = await call();
    expect(body.regions.map((r) => r.id)).toEqual(["USD", "EUR", "GBP"]);
  });
  it("lists the default plus the backend's enabled currencies, including ones without a rate", async () => {
    describeCapabilities.mockRejectedValue(new Error("no backend"));
    readCurrencyRates.mockResolvedValue({ baseCurrency: "USD", rates: { EUR: 0.95 }, currencies: ["USD", "EUR", "GBP"] });
    const body = await call();
    expect(body.regions.map((r) => r.id)).toEqual(["USD", "EUR", "GBP"]);
  });

  it("dedupes the default currency when the enabled list already contains it", async () => {
    describeCapabilities.mockRejectedValue(new Error("no backend"));
    readCurrencyRates.mockResolvedValue({ baseCurrency: "EUR", rates: {}, currencies: ["EUR", "usd"] });
    const body = await call();
    expect(body.regions.map((r) => r.id)).toEqual(["USD", "EUR"]);
  });
});
