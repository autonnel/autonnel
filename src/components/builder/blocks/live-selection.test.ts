import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

const apiCall = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiCall: (...args: unknown[]) => apiCall(...args) }));
import { priceSelectionLive, useLiveSelection } from './live-selection';
import { LivePricingProvider } from '../live-pricing';
import { CurrencyProvider } from '../LanguageContext';
import type { ShopProductDto } from '@/contracts/shop';

const product = (over: Partial<ShopProductDto>): ShopProductDto => ({
  id: 'p', name: 'P', description: null, thumbnail: null, price: 0, comparePrice: null, currency: 'EUR', variants: [], ...over,
});

describe('priceSelectionLive', () => {
  it('prices the line as live unit price times quantity and keeps editor labels', () => {
    const out = priceSelectionLive(
      [{ id: 'v1', productId: 'p', productName: 'Custom name', price: 10, comparePrice: 99, quantity: 2, currency: 'USD', badgeLabel: 'Hot' }],
      [product({ variants: [{ id: 'v1', name: 'V', price: 11.99, comparePrice: 15, priceCurrency: 'EUR' }] })],
      'EUR',
    );
    expect(out).toEqual([
      { id: 'v1', productId: 'p', productName: 'Custom name', price: 23.98, comparePrice: 30, quantity: 2, currency: 'EUR', badgeLabel: 'Hot' },
    ]);
  });

  it('prices a simple product from the product row and drops compare prices not above the price', () => {
    const out = priceSelectionLive(
      [{ id: 'p', productId: 'p', productName: 'Simple', price: 1, comparePrice: 5, quantity: 1 }],
      [product({ price: 20, comparePrice: 20, priceCurrency: 'EUR' })],
      'EUR',
    );
    expect(out).toEqual([{ id: 'p', productId: 'p', productName: 'Simple', price: 20, quantity: 1, currency: 'EUR' }]);
  });

  it('never falls back to another currency or to the stored price', () => {
    const out = priceSelectionLive(
      [
        { id: 'usd-only', productId: 'p', productName: 'A', price: 15, quantity: 1 },
        { id: 'missing', productId: 'p', productName: 'B', price: 15, quantity: 1 },
        { id: 'gone', productId: 'deleted', productName: 'C', price: 15, quantity: 1 },
      ],
      [product({ variants: [{ id: 'usd-only', name: 'A', price: 15, priceCurrency: 'USD' }] })],
      'EUR',
    );
    expect(out).toEqual([]);
  });

  it('keeps a free gift priced at 0 in the checkout currency and drops one without a currency', () => {
    const out = priceSelectionLive(
      [
        { id: 'gift', productId: 'p', productName: 'Gift', price: 0, quantity: 1 },
        { id: 'nocur', productId: 'p', productName: 'No currency', price: 0, quantity: 1 },
      ],
      [product({ variants: [{ id: 'gift', name: 'Gift', price: 0, priceCurrency: 'EUR' }, { id: 'nocur', name: 'N', price: 0 }] })],
      'EUR',
    );
    expect(out).toEqual([{ id: 'gift', productId: 'p', productName: 'Gift', price: 0, quantity: 1, currency: 'EUR' }]);
  });
});

describe('useLiveSelection', () => {
  afterEach(() => {
    apiCall.mockReset();
    vi.useRealTimers();
  });

  it('retries a failed live lookup once before showing nothing purchasable', async () => {
    apiCall
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ products: [product({ variants: [{ id: 'v1', name: 'V', price: 9.99, priceCurrency: 'EUR' }] })] });
    const items = [{ id: 'v1', productId: 'p', productName: 'P', price: 1, quantity: 1 }];
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(CurrencyProvider, { value: 'EUR' }, React.createElement(LivePricingProvider, { value: true }, children));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useLiveSelection(items, 'USD'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });
    expect(apiCall).toHaveBeenCalledTimes(2);
    expect(result.current.items.map((i) => i.price)).toEqual([9.99]);
  });

  it('shows nothing purchasable after the retry also fails', async () => {
    apiCall.mockRejectedValue(new Error('network'));
    const items = [{ id: 'v1', productId: 'p', productName: 'P', price: 1, quantity: 1 }];
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(CurrencyProvider, { value: 'EUR' }, React.createElement(LivePricingProvider, { value: true }, children));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useLiveSelection(items, 'USD'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });
    expect(apiCall).toHaveBeenCalledTimes(2);
    expect(result.current.items).toEqual([]);
  });
});
