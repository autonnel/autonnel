import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

const apiCall = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiCall: (...args: unknown[]) => apiCall(...args) }));

import { VariantSelector } from './VariantSelector';
import { LanguageProvider, CurrencyProvider } from '../LanguageContext';
import { LivePricingProvider } from '../live-pricing';
import { CHECKOUT_CURRENCY_GLOBAL } from '@/lib/storefront/checkout-currency';
import type { ProductSelectionData } from './product-selection-types';

const stored: ProductSelectionData = {
  currency: 'EUR',
  items: [
    { id: 'ser-1', productId: 'p-ser', productName: 'Serum', variantName: '1 Bottle', price: 31, quantity: 1, currency: 'USD' },
    { id: 'ser-3', productId: 'p-ser', productName: 'Serum', variantName: '3 Bottles', price: 69, quantity: 1, currency: 'USD' },
    { id: 'mask-1', productId: 'p-mask', productName: 'Mask', variantName: 'Single Mask', price: 15, quantity: 1, currency: 'USD' },
  ],
};

const liveEur = {
  products: [
    {
      id: 'p-ser', name: 'Serum', description: null, thumbnail: null, price: 29.99, comparePrice: 37.99,
      currency: 'EUR', priceCurrency: 'EUR',
      variants: [
        { id: 'ser-1', name: '1 Bottle', price: 29.99, comparePrice: 37.99, priceCurrency: 'EUR' },
        { id: 'ser-3', name: '3 Bottles', price: 65.99, priceCurrency: 'EUR' },
      ],
    },
    {
      id: 'p-mask', name: 'Mask', description: null, thumbnail: null, price: 0, comparePrice: null,
      currency: 'EUR', variants: [{ id: 'mask-1', name: 'Single Mask', price: 0 }],
    },
  ],
};

type Selected = { products: Array<{ id: string; price: number }>; currency: string };

function captureSelections(): Selected[] {
  const seen: Selected[] = [];
  window.addEventListener('autonnel:productsSelected', (e) => seen.push((e as CustomEvent).detail));
  return seen;
}

function mount(opts: { live: boolean; pageCurrency: string; selection?: ProductSelectionData }) {
  return render(
    <LanguageProvider value="de">
      <CurrencyProvider value={opts.pageCurrency}>
        <LivePricingProvider value={opts.live}>
          <VariantSelector selectedItems={opts.selection ?? stored} />
        </LivePricingProvider>
      </CurrencyProvider>
    </LanguageProvider>,
  );
}

const productQueries = () => apiCall.mock.calls.filter(([key]) => key === 'GET /api/shop/products');

describe('VariantSelector live pricing on storefront pages', () => {
  beforeEach(() => {
    apiCall.mockReset();
    delete (window as unknown as Record<string, unknown>)[CHECKOUT_CURRENCY_GLOBAL];
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)[CHECKOUT_CURRENCY_GLOBAL];
  });

  it('shows live prices in the checkout currency and drops items without a price in it', async () => {
    let release: (v: unknown) => void = () => {};
    apiCall.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const seen = captureSelections();
    mount({ live: true, pageCurrency: 'EUR' });

    expect(document.body.textContent).not.toMatch(/31,00|69,00|15,00/);
    expect(seen).toHaveLength(0);

    await act(async () => release(liveEur));
    await waitFor(() => expect(document.body.textContent).toMatch(/29,99\s€/));
    expect(document.body.textContent).toMatch(/65,99\s€/);
    expect(document.body.textContent).not.toMatch(/Single Mask/);
    expect(document.body.textContent).not.toMatch(/31,00|15,00/);

    const [, , opts] = productQueries()[0];
    expect(opts.query.regionId).toBe('EUR');
    expect(opts.query.productIds.split(',').sort()).toEqual(['p-mask', 'p-ser']);

    const last = seen[seen.length - 1];
    expect(last.currency).toBe('EUR');
    expect(last.products.map((p) => p.id)).toEqual(['ser-1']);
    expect(last.products[0].price).toBe(29.99);
  });

  it('keeps a free gift priced at 0 in the checkout currency in the broadcast', async () => {
    const withGift: ProductSelectionData = {
      currency: 'EUR',
      items: [stored.items[0], { id: 'gift-1', productId: 'p-gift', productName: 'Gift', price: 0, quantity: 1 }],
    };
    apiCall.mockResolvedValue({
      products: [
        liveEur.products[0],
        { id: 'p-gift', name: 'Gift', description: null, thumbnail: null, price: 0, comparePrice: null, currency: 'EUR',
          variants: [{ id: 'gift-1', name: 'Gift', price: 0, priceCurrency: 'EUR' }] },
      ],
    });
    const seen = captureSelections();
    mount({ live: true, pageCurrency: 'EUR', selection: withGift });
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen[seen.length - 1].products.map((p) => p.id)).toEqual(['ser-1', 'gift-1']);
  });

  it('uses the injected checkout session currency on upsell pages', async () => {
    (window as unknown as Record<string, unknown>)[CHECKOUT_CURRENCY_GLOBAL] = 'EUR';
    apiCall.mockResolvedValue(liveEur);
    const seen = captureSelections();
    mount({ live: true, pageCurrency: '' });

    await waitFor(() => expect(document.body.textContent).toMatch(/29,99\s€/));
    expect(productQueries()[0][2].query.regionId).toBe('EUR');
    expect(seen[seen.length - 1].currency).toBe('EUR');
  });

  it('removes a line the server rejected and re-broadcasts without it', async () => {
    apiCall.mockResolvedValue(liveEur);
    const seen = captureSelections();
    mount({ live: true, pageCurrency: 'EUR' });
    await waitFor(() => expect(screen.getByText(/1 Bottle/)).toBeTruthy());

    act(() => {
      window.dispatchEvent(new CustomEvent('autonnel:cartLineRejected', { detail: { variantId: 'ser-1' } }));
    });

    await waitFor(() => expect(document.body.textContent).not.toMatch(/1 Bottle/));
    expect(seen[seen.length - 1].products.map((p) => p.id)).toEqual(['ser-3']);
  });

  it('shows the translated unavailable message when nothing is sellable in the currency', async () => {
    apiCall.mockResolvedValue({ products: [liveEur.products[1]] });
    mount({ live: true, pageCurrency: 'EUR', selection: { currency: 'EUR', items: [stored.items[2]] } });
    await waitFor(() => expect(screen.getByText('Dieses Produkt ist nicht zum Kauf verfügbar.')).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/15,00/);
  });

  it('keeps editor-stored prices outside the storefront', () => {
    mount({ live: false, pageCurrency: 'EUR' });
    expect(apiCall).not.toHaveBeenCalled();
    expect(document.body.textContent).toMatch(/31,00/);
  });
});
