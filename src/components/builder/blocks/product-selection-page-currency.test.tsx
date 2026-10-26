import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiCall = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiCall: (...args: unknown[]) => apiCall(...args) }));

import { ProductSelectionModal } from './ProductSelectionModal';
import { ProductSelectorField } from './ProductSelectorField';
import { EditorPageCurrencyContext } from '../fields/editor-page-currency';

const product = {
  id: 'p1',
  name: 'Tee',
  description: null,
  thumbnail: null,
  price: 10,
  comparePrice: null,
  currency: 'EUR',
  priceCurrency: 'EUR',
  variants: [
    { id: 'v-eur', name: 'Small', price: 10, priceCurrency: 'EUR' },
    { id: 'v-usd', name: 'Large', price: 12, priceCurrency: 'USD' },
    { id: 'v-none', name: 'XL', price: 0 },
  ],
};

beforeEach(() => {
  apiCall.mockReset();
  apiCall.mockImplementation(async (key: string) => {
    if (key === 'GET /api/shop/regions') return { regions: [] };
    return { products: [product], hasMore: false };
  });
});

describe('page currency in the product selection modal', () => {
  it('marks variants without a page-currency price as unavailable and not selectable', async () => {
    const onSelect = vi.fn();
    render(
      <ProductSelectionModal isOpen onClose={() => {}} selectedItems={[]} pageCurrency="EUR" onSelect={onSelect} />,
    );
    fireEvent.click(await screen.findByText('Tee'));
    await waitFor(() => expect(screen.getByText('Small')).toBeTruthy());
    expect(screen.getAllByText('No price in EUR')).toHaveLength(2);
    fireEvent.click(screen.getByText('Large'));
    fireEvent.click(screen.getByText('XL'));
    fireEvent.click(screen.getByText('Small'));
    const queries = apiCall.mock.calls.filter(([key]) => key === 'GET /api/shop/products');
    expect(queries[0][2].query.regionId).toBe('EUR');
    fireEvent.click(screen.getByText('Confirm Selection'));
    const data = onSelect.mock.calls[0][0];
    expect(data.items.map((i: { id: string }) => i.id)).toEqual(['v-eur']);
    expect(data.currency).toBe('EUR');
  });
});

describe('page currency in the product selector field', () => {
  it('flags only selected items priced in another currency', () => {
    render(
      <EditorPageCurrencyContext.Provider value="EUR">
        <ProductSelectorField
          value={{
            currency: 'EUR',
            items: [
              { id: 'a', productId: 'p', productName: 'Priced', price: 10, quantity: 1, currency: 'EUR' },
              { id: 'b', productId: 'p', productName: 'Unpriced', price: 10, quantity: 1, currency: 'USD' },
            ],
          }}
          onChange={() => {}}
        />
      </EditorPageCurrencyContext.Provider>,
    );
    expect(screen.getAllByText('No price in EUR')).toHaveLength(1);
  });
});
