import { describe, it, expect, afterEach } from 'vitest';
import {
  applyParamsToHref,
  collectPropagatedParams,
  isPropagatableHref,
  readExtraLinkParams,
  withPropagatedParams,
} from './link-params';

describe('collectPropagatedParams', () => {
  it('keeps every marketing param on the page', () => {
    expect(collectPropagatedParams('?fbclid=abc&utm_source=fb&sub1=x')).toEqual({
      fbclid: 'abc',
      utm_source: 'fb',
      sub1: 'x',
    });
  });

  it('drops the identity params, which travel on the anid cookie', () => {
    expect(collectPropagatedParams('?anid=v1&goid=old&gclid=g')).toEqual({ gclid: 'g' });
  });

  it('drops the operator-only depth deep link so it cannot follow a visitor', () => {
    expect(collectPropagatedParams('?_ad=40&ttclid=t')).toEqual({ ttclid: 't' });
  });

  it('keeps the first value of a repeated key', () => {
    expect(collectPropagatedParams('?utm_source=a&utm_source=b')).toEqual({ utm_source: 'a' });
  });

  it('merges SSR extras without letting them shadow a URL param', () => {
    expect(collectPropagatedParams('?funnelId=fromUrl', { funnelId: 'fromSsr', extra: 'e' })).toEqual({
      funnelId: 'fromUrl',
      extra: 'e',
    });
  });

  it('blocks identity params supplied as extras too', () => {
    expect(collectPropagatedParams('', { anid: 'v1', utm_medium: 'cpc' })).toEqual({ utm_medium: 'cpc' });
  });

  it('returns nothing for a bare URL', () => {
    expect(collectPropagatedParams('')).toEqual({});
  });
});

describe('isPropagatableHref', () => {
  it('accepts real navigation targets', () => {
    expect(isPropagatableHref('/checkout')).toBe(true);
    expect(isPropagatableHref('https://shop.test/upsell')).toBe(true);
    expect(isPropagatableHref('next?a=1')).toBe(true);
  });

  it('rejects hrefs that never navigate', () => {
    for (const href of ['', '   ', '#top', 'mailto:a@b.c', 'tel:+1', 'sms:+1', 'javascript:void(0)', 'data:text/html,x']) {
      expect(isPropagatableHref(href)).toBe(false);
    }
  });
});

describe('applyParamsToHref', () => {
  const base = 'https://shop.test/lp?fbclid=abc';
  const params = { fbclid: 'abc', utm_source: 'fb' };

  it('appends the missing params to a root-relative href and keeps it relative', () => {
    expect(applyParamsToHref('/checkout', params, base)).toBe('/checkout?fbclid=abc&utm_source=fb');
  });

  it('keeps a document-relative href relative after resolving it', () => {
    expect(applyParamsToHref('upsell', params, 'https://shop.test/funnel/lp')).toBe(
      '/funnel/upsell?fbclid=abc&utm_source=fb',
    );
  });

  it('leaves an existing value alone instead of overwriting it', () => {
    expect(applyParamsToHref('/checkout?utm_source=email', params, base)).toBe(
      '/checkout?utm_source=email&fbclid=abc',
    );
  });

  it('preserves the hash', () => {
    expect(applyParamsToHref('/checkout#form', { gclid: 'g' }, base)).toBe('/checkout?gclid=g#form');
  });

  it('returns an absolute href for an absolute same-origin link', () => {
    expect(applyParamsToHref('https://shop.test/checkout', { gclid: 'g' }, base)).toBe(
      'https://shop.test/checkout?gclid=g',
    );
  });

  it('forwards to another origin, which is where the money link usually points', () => {
    expect(applyParamsToHref('https://www.taiora.com/products/x', params, base)).toBe(
      'https://www.taiora.com/products/x?fbclid=abc&utm_source=fb',
    );
  });

  it('keeps a protocol-relative link on the page protocol', () => {
    expect(applyParamsToHref('//other.test/x', { gclid: 'g' }, base)).toBe('https://other.test/x?gclid=g');
  });

  it('preserves an existing cross-origin query, appending only what is missing', () => {
    expect(applyParamsToHref('https://www.taiora.com/cart/439:1?ref=hero', params, base)).toBe(
      'https://www.taiora.com/cart/439:1?ref=hero&fbclid=abc&utm_source=fb',
    );
  });

  it('skips schemes a query string cannot travel on', () => {
    expect(applyParamsToHref('ftp://files.test/x', params, base)).toBeNull();
    expect(applyParamsToHref('whatsapp://send?text=hi', params, base)).toBeNull();
  });

  it('returns null when every param is already present, so the href is left untouched', () => {
    expect(applyParamsToHref('/checkout?fbclid=abc&utm_source=fb', params, base)).toBeNull();
  });

  it('returns null for non-navigational hrefs', () => {
    expect(applyParamsToHref('#section', params, base)).toBeNull();
    expect(applyParamsToHref('mailto:a@b.c', params, base)).toBeNull();
  });

  it('returns null when there is nothing to propagate', () => {
    expect(applyParamsToHref('/checkout', {}, base)).toBeNull();
  });
});

describe('readExtraLinkParams', () => {
  afterEach(() => {
    delete window.__AUTONNEL_LINK_PARAMS__;
  });

  it('returns an empty map when the global is absent', () => {
    expect(readExtraLinkParams()).toEqual({});
  });

  it('keeps only non-empty string values', () => {
    window.__AUTONNEL_LINK_PARAMS__ = { funnelId: 'f1', blank: '', bad: 7 as unknown as string };
    expect(readExtraLinkParams()).toEqual({ funnelId: 'f1' });
  });
});

describe('withPropagatedParams', () => {
  afterEach(() => {
    delete window.__AUTONNEL_LINK_PARAMS__;
    window.history.replaceState({}, '', '/');
  });

  it('carries the page params onto a script-driven navigation target', () => {
    window.history.replaceState({}, '', '/lp?fbclid=abc&anid=v1');
    expect(withPropagatedParams('/thank-you?orderId=1')).toBe('/thank-you?orderId=1&fbclid=abc');
  });

  it('returns the target unchanged when there is nothing to add', () => {
    window.history.replaceState({}, '', '/lp');
    expect(withPropagatedParams('/thank-you')).toBe('/thank-you');
  });

  it('folds in the SSR-injected funnel context', () => {
    window.history.replaceState({}, '', '/lp');
    window.__AUTONNEL_LINK_PARAMS__ = { funnelId: 'f1' };
    expect(withPropagatedParams('/upsell')).toBe('/upsell?funnelId=f1');
  });
});
