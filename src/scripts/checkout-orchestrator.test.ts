import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('checkout orchestrator cart sync', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__AUTONNEL_PAGE_TYPE__ = 'CHECKOUT';
    window.__AUTONNEL_PAGE_SLUG__ = 'checkout-eur';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('announces a cart line the server rejected so the page stops offering it', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      if (path === '/api/checkout/session') return jsonResponse(200, {});
      return jsonResponse(422, { error: 'Variant is not sellable' });
    }));
    const rejected: unknown[] = [];
    window.addEventListener('autonnel:cartLineRejected', (e) => rejected.push((e as CustomEvent).detail));

    await import('./checkout-orchestrator');
    window.dispatchEvent(
      new CustomEvent('autonnel:productsSelected', {
        detail: { currency: 'EUR', products: [{ id: 'mask-1', productId: 'p-mask', price: 15, quantity: 1 }] },
      }),
    );

    await vi.waitFor(() => expect(rejected).toHaveLength(1));
    expect(rejected[0]).toMatchObject({ variantId: 'mask-1' });
    expect(window.__AUTONNEL_PRODUCTS__).toEqual([]);
  });
});
