import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectedProducts } from './hooks';

describe('useSelectedProducts', () => {
  afterEach(() => {
    delete (window as { __AUTONNEL_TENANT_ID__?: string }).__AUTONNEL_TENANT_ID__;
  });

  it('drops a line the server rejected from the summary', () => {
    (window as { __AUTONNEL_TENANT_ID__?: string }).__AUTONNEL_TENANT_ID__ = 't1';
    const { result } = renderHook(() => useSelectedProducts());
    act(() => {
      window.dispatchEvent(
        new CustomEvent('autonnel:productsSelected', {
          detail: {
            currency: 'EUR',
            products: [
              { id: 'mask-1', productId: 'p-mask', price: 15, quantity: 1 },
              { id: 'gift', productId: 'p-gift', price: 0, quantity: 1 },
            ],
          },
        }),
      );
    });
    expect(result.current.products).toHaveLength(2);

    act(() => {
      window.dispatchEvent(new CustomEvent('autonnel:cartLineRejected', { detail: { variantId: 'mask-1' } }));
    });
    expect(result.current.products.map((p) => (p as { id?: string }).id)).toEqual(['gift']);
  });
});
