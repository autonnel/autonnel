import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  verified: null as string | null,
  session: null as { linkedSaleId: string | null } | null,
}));

vi.mock('@/composition/storefront-runtime', () => ({
  storefrontCheckoutDepsFromLocals: () => ({}),
}));
vi.mock('@/composition/make-storefront-checkout', () => ({
  makeStorefrontCheckout: () => ({
    sessions: {
      verifyCookieValue: async () => h.verified,
      load: async () => h.session,
    },
  }),
}));

import { ownsSale, readCookieValue } from '../sale-ownership';

// happy-dom's Request constructor strips `cookie` (a browser-forbidden request header). Node and
// workerd both preserve it, so the request is assembled from a Headers instance — which does keep
// the value — to exercise the real `request.headers.get('cookie')` path.
function requestWithCookie(cookie?: string): Request {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return { headers } as unknown as Request;
}

const withCookie = (value?: string) =>
  requestWithCookie(value ? `an_checkout_session=${value}` : undefined);

beforeEach(() => {
  h.verified = 's1';
  h.session = { linkedSaleId: 'sale-1' };
});

describe('readCookieValue', () => {
  it('extracts the named cookie among several', () => {
    const req = requestWithCookie('anid=v1; an_checkout_session=abc.def; other=x');
    expect(readCookieValue(req, 'an_checkout_session')).toBe('abc.def');
  });

  it('returns null when the cookie header is absent', () => {
    expect(readCookieValue(requestWithCookie(), 'an_checkout_session')).toBeNull();
  });
});

describe('ownsSale', () => {
  it('is true when the signed session links exactly this sale', async () => {
    expect(await ownsSale(withCookie('signed'), {}, 'sale-1')).toBe(true);
  });

  it('is false when no cookie is present', async () => {
    expect(await ownsSale(withCookie(), {}, 'sale-1')).toBe(false);
  });

  it('is false when the signature does not verify', async () => {
    h.verified = null;
    expect(await ownsSale(withCookie('tampered'), {}, 'sale-1')).toBe(false);
  });

  it('is false when the session no longer exists', async () => {
    h.session = null;
    expect(await ownsSale(withCookie('signed'), {}, 'sale-1')).toBe(false);
  });

  it('is false when the session links a different sale', async () => {
    h.session = { linkedSaleId: 'sale-2' };
    expect(await ownsSale(withCookie('signed'), {}, 'sale-1')).toBe(false);
  });

  it('is false when the session has not linked any sale yet', async () => {
    h.session = { linkedSaleId: null };
    expect(await ownsSale(withCookie('signed'), {}, 'sale-1')).toBe(false);
  });

  it('is false for an empty saleRef even if the session links one', async () => {
    expect(await ownsSale(withCookie('signed'), {}, '')).toBe(false);
  });
});
