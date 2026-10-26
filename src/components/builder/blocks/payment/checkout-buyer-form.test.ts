import { describe, it, expect, beforeEach } from 'vitest';
import { collectCheckoutBuyer, redirectProviders } from './checkout-buyer-form';

function field(name: string, value: string) {
  const el = document.createElement('input');
  el.name = name;
  el.value = value;
  document.body.appendChild(el);
}

describe('collectCheckoutBuyer', () => {
  beforeEach(() => { document.body.innerHTML = ''; (window as any).__CHECKOUT_STATE__ = undefined; });

  it('reports missing required fields', () => {
    field('email', 'a@b.co');
    const r = collectCheckoutBuyer();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain('First Name');
  });

  it('rejects an invalid email', () => {
    for (const [k, v] of [['email', 'nope'], ['firstName', 'A'], ['lastName', 'B'], ['phone', '1'], ['address1', 'x'], ['city', 'c'], ['postalCode', 'p']]) field(k!, v!);
    const r = collectCheckoutBuyer();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/valid email/);
  });

  it('builds the buyer from the form', () => {
    for (const [k, v] of [['email', 'a@b.co'], ['firstName', 'Ada'], ['lastName', 'L'], ['phone', '555'], ['address1', '1 Main'], ['city', 'Austin'], ['postalCode', '73301'], ['country', 'US'], ['state', 'TX']]) field(k!, v!);
    const r = collectCheckoutBuyer();
    expect(r).toEqual({ ok: true, buyer: { fullName: 'Ada L', email: 'a@b.co', phone: '555', address: { line1: '1 Main', line2: undefined, city: 'Austin', region: 'TX', countryCode: 'US', postalCode: '73301' } } });
  });

  it('builds the buyer from checkout state when it is present and the DOM is empty', () => {
    (window as any).__CHECKOUT_STATE__ = {
      customerInfo: { email: 'a@b.co', firstName: 'Ada', lastName: 'L', phone: '555' },
      shippingAddress: { address1: '1 Main', address2: 'Apt 2', city: 'Austin', state: 'TX', postalCode: '73301', country: '' },
      currentOrderId: null,
    };
    expect(collectCheckoutBuyer()).toEqual({ ok: true, buyer: { fullName: 'Ada L', email: 'a@b.co', phone: '555', address: { line1: '1 Main', line2: 'Apt 2', city: 'Austin', region: 'TX', countryCode: 'US', postalCode: '73301' } } });
  });
});

describe('redirectProviders', () => {
  it('lists only redirect-style providers', () => {
    expect(redirectProviders({ providers: { card: { publishableKey: 'pk' }, acme: { redirect: true, provider: 'ACME', label: 'Card' } } })).toEqual([{ method: 'acme', provider: 'ACME', label: 'Card' }]);
    expect(redirectProviders(undefined)).toEqual([]);
  });
});
