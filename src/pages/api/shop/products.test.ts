import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  StorefrontCatalogReadPort,
  StorefrontProductView,
} from "@/modules/commerce-gateway/application/ports/inbound";
import type { ShopProductListDto, ShopProductSingleDto } from "@/contracts/shop";

const readPort = {
  list: vi.fn(),
  getByRef: vi.fn(),
  search: vi.fn(),
  availableCurrencies: vi.fn(),
} satisfies Record<keyof StorefrontCatalogReadPort, ReturnType<typeof vi.fn>>;

vi.mock("@/composition/make-commerce-gateway", () => ({
  makeLiveStorefrontCatalogReadSide: async () => readPort,
}));

import { GET } from "./products";

function view(over: Partial<StorefrontProductView> = {}): StorefrontProductView {
  return {
    ref: "gid://p/1",
    title: "Tee",
    status: "active",
    thumbnail: "https://cdn/p1.jpg",
    mediaRefs: ["https://cdn/p1.jpg"],
    priceMinor: 1999,
    comparePriceMinor: 2499,
    currencyCode: "USD",
    variants: [
      { ref: "gid://v/1", title: "Small", sku: "S", priceMinor: 1999, comparePriceMinor: 2499, currencyCode: "USD", thumbnail: "https://cdn/p1.jpg" },
    ],
    ...over,
  };
}

async function call(qs: string): Promise<ShopProductListDto | ShopProductSingleDto> {
  const request = new Request(`https://shop.test/api/shop/products?${qs}`);
  const res = await (GET as any)({ request, params: {}, locals: {} });
  return res.json();
}

beforeEach(() => {
  readPort.list.mockReset();
  readPort.getByRef.mockReset();
  readPort.search.mockReset();
});

describe("GET /api/shop/products", () => {
  it("maps a list page to ShopProductDto (major units, fallback currency)", async () => {
    readPort.list.mockResolvedValue({ products: [view()], hasMore: true });
    const body = (await call("limit=10")) as ShopProductListDto;
    expect(body.products).toHaveLength(1);
    expect(body.products[0].price).toBe(19.99);
    expect(body.products[0].currency).toBe("USD");
    expect(body.products[0].variants[0].price).toBe(19.99);
    expect(body.products[0].description).toBeNull();
    expect(body.hasMore).toBe(true);
  });

  it("surfaces a non-null comparePrice (product + variant) in major units", async () => {
    readPort.list.mockResolvedValue({ products: [view()], hasMore: false });
    const body = (await call("limit=10")) as ShopProductListDto;
    expect(body.products[0].comparePrice).toBe(24.99);
    expect(body.products[0].variants[0].comparePrice).toBe(24.99);
  });

  it("omits comparePrice when the projection has none", async () => {
    readPort.list.mockResolvedValue({
      products: [view({ comparePriceMinor: null, variants: [{ ref: "gid://v/1", title: "Small", priceMinor: 1999, comparePriceMinor: null, currencyCode: "USD", thumbnail: null }] })],
      hasMore: false,
    });
    const body = (await call("limit=10")) as ShopProductListDto;
    expect(body.products[0].comparePrice).toBeNull();
    expect(body.products[0].variants[0].comparePrice).toBeUndefined();
  });

  it("returns a single product for action=single", async () => {
    readPort.getByRef.mockResolvedValue(view());
    const body = (await call("action=single&productId=gid://p/1")) as ShopProductSingleDto;
    expect(body.product?.id).toBe("gid://p/1");
    expect(readPort.getByRef).toHaveBeenCalledWith("gid://p/1", expect.any(Object));
  });

  it("passes regionId currency into the price query (single)", async () => {
    readPort.getByRef.mockResolvedValue(view({ priceMinor: 1799, currencyCode: "EUR" }));
    const body = (await call("action=single&productId=gid://p/1&regionId=EUR")) as ShopProductSingleDto;
    expect(readPort.getByRef.mock.calls[0][1]).toMatchObject({ currencyCode: "EUR" });
    expect(body.product?.currency).toBe("EUR");
    expect(body.product?.price).toBe(17.99);
  });

  it("skipPricing omits the currency from the price query", async () => {
    readPort.list.mockResolvedValue({ products: [view()], hasMore: false });
    await call("skipPricing=true&regionId=EUR");
    expect(readPort.list.mock.calls[0][0].currencyCode).toBeUndefined();
  });

  it("uses search when q is provided", async () => {
    readPort.search.mockResolvedValue([view()]);
    const body = (await call("q=tee")) as ShopProductListDto;
    expect(readPort.search).toHaveBeenCalledWith("tee", expect.objectContaining({ limit: 50 }));
    expect(body.products).toHaveLength(1);
  });

  it("returns an error DTO when the read throws", async () => {
    readPort.list.mockRejectedValue(new Error("boom"));
    const body = (await call("limit=10")) as ShopProductListDto;
    expect(body.products).toEqual([]);
    expect(body.error).toBeTruthy();
  });
});
