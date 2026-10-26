import { describe, it, expect, vi } from 'vitest';
import { resolveStorefrontCheckoutCurrency } from './storefront-checkout-currency';

function deps(session: string | null) {
  return { sessionCurrency: vi.fn(async () => session), defaultCurrency: () => 'USD' };
}

describe('resolveStorefrontCheckoutCurrency', () => {
  it('uses the paid session market on upsell pages', async () => {
    const d = deps('EUR');
    await expect(resolveStorefrontCheckoutCurrency({ pageType: 'UPSELL', pageCurrency: '', sessionCookie: 'signed' }, d)).resolves.toBe('EUR');
    expect(d.sessionCurrency).toHaveBeenCalledWith('signed', undefined);
  });

  it('falls back to the page currency, then the store default, without a valid session', async () => {
    await expect(resolveStorefrontCheckoutCurrency({ pageType: 'UPSELL', pageCurrency: 'gbp', sessionCookie: 'bad' }, deps(null))).resolves.toBe('GBP');
    await expect(resolveStorefrontCheckoutCurrency({ pageType: 'UPSELL', pageCurrency: '', sessionCookie: null }, deps(null))).resolves.toBe('USD');
  });

  it('uses the page currency on checkout pages and ignores the session', async () => {
    const d = deps('EUR');
    await expect(resolveStorefrontCheckoutCurrency({ pageType: 'CHECKOUT', pageCurrency: 'GBP', sessionCookie: 'signed' }, d)).resolves.toBe('GBP');
    await expect(resolveStorefrontCheckoutCurrency({ pageType: 'CHECKOUT', pageCurrency: undefined, sessionCookie: 'signed' }, d)).resolves.toBe('USD');
    expect(d.sessionCurrency).not.toHaveBeenCalled();
  });

  it('ignores a malformed page currency', async () => {
    await expect(resolveStorefrontCheckoutCurrency({ pageType: 'CHECKOUT', pageCurrency: '<script>', sessionCookie: null }, deps(null))).resolves.toBe('USD');
  });
});
