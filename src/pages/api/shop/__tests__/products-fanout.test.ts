import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  calls: [] as string[],
  inFlight: 0,
  peak: 0,
}));

vi.mock('@/composition/make-commerce-gateway', () => ({
  makeLiveStorefrontCatalogReadSide: async () => ({
    getByRef: async (ref: string) => {
      h.calls.push(ref);
      h.inFlight += 1;
      h.peak = Math.max(h.peak, h.inFlight);
      await new Promise((r) => setTimeout(r, 1));
      h.inFlight -= 1;
      return { id: ref, title: ref, price: { amountMinor: 100, currencyCode: 'USD' } };
    },
    search: async () => [],
    list: async () => ({ products: [], hasMore: false }),
  }),
}));
vi.mock('@/lib/storefront/shop-catalog.mapper', () => ({
  getDefaultCurrencyCode: () => 'USD',
  toShopProductDto: (v: { id: string }) => ({ id: v.id }),
}));

import { GET, MAX_PRODUCT_IDS, PRODUCT_LOOKUP_CONCURRENCY } from '../products';

function ctx(qs: string) {
  return {
    request: new Request(`http://shop.test/api/shop/products?${qs}`),
    locals: {},
    params: {},
  } as never;
}

beforeEach(() => {
  h.calls = [];
  h.inFlight = 0;
  h.peak = 0;
});

describe('GET /api/shop/products — productIds fan-out', () => {
  it('caps the number of backend lookups', async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `p${i}`).join(',');
    const res = await GET(ctx(`productIds=${ids}`));
    expect(res.status).toBe(200);
    expect(h.calls.length).toBe(MAX_PRODUCT_IDS);
  });

  it('deduplicates repeated ids before dispatching', async () => {
    const ids = Array.from({ length: 100 }, () => 'same').join(',');
    await GET(ctx(`productIds=${ids}`));
    expect(h.calls).toEqual(['same']);
  });

  it('never exceeds the concurrency budget', async () => {
    const ids = Array.from({ length: MAX_PRODUCT_IDS }, (_, i) => `q${i}`).join(',');
    await GET(ctx(`productIds=${ids}`));
    expect(h.peak).toBeLessThanOrEqual(PRODUCT_LOOKUP_CONCURRENCY);
  });

  it('still returns the products it did fetch', async () => {
    const res = await GET(ctx('productIds=a,b,c'));
    const body = (await res.json()) as { products: { id: string }[] };
    expect(body.products.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});
