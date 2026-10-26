import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

const apiCall = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiCall: (...args: unknown[]) => apiCall(...args) }));
import { CouponField } from './CouponField';
import { LanguageProvider, CurrencyProvider } from '../LanguageContext';

afterEach(() => cleanup());

function mount(language: string, currency: string) {
  return render(
    <LanguageProvider value={language}>
      <CurrencyProvider value={currency}>
        <CouponField />
      </CurrencyProvider>
    </LanguageProvider>,
  );
}

function applyFixed(discountValue: number) {
  act(() => {
    window.dispatchEvent(new CustomEvent('autonnel:couponApplied', {
      detail: { code: 'FIVE', discount: discountValue, discountType: 'FIXED_AMOUNT', discountValue },
    }));
  });
}

describe('CouponField fixed coupon badge', () => {
  it('formats with the page currency and language', () => {
    mount('de', 'EUR');
    applyFixed(5);
    expect(screen.getByText(/5,00\s?€/)).toBeTruthy();
    expect(screen.getByText('Gutschein eingelöst')).toBeTruthy();
    expect(screen.getByText('Entfernen')).toBeTruthy();
  });

  it('uses the cart currency when the page currency is the store default', () => {
    mount('en', '');
    act(() => {
      window.dispatchEvent(new CustomEvent('autonnel:productsSelected', { detail: { products: [], currency: 'GBP' } }));
    });
    applyFixed(5);
    expect(screen.getByText('£5.00')).toBeTruthy();
  });
});

describe('CouponField minimum order message', () => {
  afterEach(() => {
    delete (window as { __AUTONNEL_TENANT_ID__?: string }).__AUTONNEL_TENANT_ID__;
  });

  it('formats the converted minimum in the page language and currency', async () => {
    (window as { __AUTONNEL_TENANT_ID__?: string }).__AUTONNEL_TENANT_ID__ = 't1';
    apiCall.mockResolvedValue({ valid: false, error: 'Order must be at least 70', minOrder: { amountMinor: 6650, currencyCode: 'EUR' } });
    mount('de', 'EUR');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'MIN70' } });
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/Die Bestellung muss mindestens 66,50\s€ betragen/)).toBeTruthy();
    expect(screen.queryByText(/mindestens 70/)).toBeNull();
  });
});
