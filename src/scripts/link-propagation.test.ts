import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

let stop: (() => void) | null = null;

async function start(url: string, html: string, extra?: Record<string, string>) {
  vi.resetModules();
  window.history.replaceState({}, '', url);
  document.body.innerHTML = html;
  if (extra) window.__AUTONNEL_LINK_PARAMS__ = extra;
  const { startLinkParamPropagation } = await import('./link-propagation');
  stop = startLinkParamPropagation();
}

// The observer fires on a microtask; two turns cover the extra pass our own
// attribute writes queue up.
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function href(selector: string): string {
  return document.querySelector(selector)!.getAttribute('href')!;
}

function attr(selector: string, name: string): string {
  return document.querySelector(selector)!.getAttribute(name)!;
}

beforeEach(() => {
  delete window.__AUTONNEL_LINK_PARAMS__;
  document.body.innerHTML = '';
});

afterEach(() => {
  stop?.();
  stop = null;
});

describe('startLinkParamPropagation', () => {
  it('stamps the page params onto every same-origin link already in the document', async () => {
    await start('/lp?fbclid=abc&utm_source=fb', `
      <a id="a" href="/checkout">Buy</a>
      <a id="b" href="/policy?x=1">Policy</a>
    `);
    expect(href('#a')).toBe('/checkout?fbclid=abc&utm_source=fb');
    expect(href('#b')).toBe('/policy?x=1&fbclid=abc&utm_source=fb');
  });

  it('stamps cross-origin links too, but leaves non-navigational ones alone', async () => {
    await start('/lp?fbclid=abc', `
      <a id="ext" href="https://www.taiora.com/products/x">Buy</a>
      <a id="hash" href="#top">Top</a>
      <a id="mail" href="mailto:a@b.c">Mail</a>
      <a id="tel" href="tel:+1">Call</a>
    `);
    expect(href('#ext')).toBe('https://www.taiora.com/products/x?fbclid=abc');
    expect(href('#hash')).toBe('#top');
    expect(href('#mail')).toBe('mailto:a@b.c');
    expect(href('#tel')).toBe('tel:+1');
  });

  it('drops the identity and depth-marker params', async () => {
    await start('/lp?anid=v1&goid=old&_ad=40&gclid=g', '<a id="a" href="/checkout">Buy</a>');
    expect(href('#a')).toBe('/checkout?gclid=g');
  });

  it('decorates a link an island renders after hydration', async () => {
    await start('/lp?fbclid=abc', '<div id="island"></div>');
    document.getElementById('island')!.innerHTML = '<a id="late" href="/upsell">Add</a>';
    await settle();
    expect(href('#late')).toBe('/upsell?fbclid=abc');
  });

  it('re-decorates a link whose href a re-render reset', async () => {
    await start('/lp?fbclid=abc', '<a id="a" href="/checkout">Buy</a>');
    document.querySelector('#a')!.setAttribute('href', '/checkout');
    await settle();
    expect(href('#a')).toBe('/checkout?fbclid=abc');
  });

  it('decorates a link created and clicked before the observer catches up', async () => {
    await start('/lp?fbclid=abc', '<div id="host"></div>');
    const link = document.createElement('a');
    link.id = 'fresh';
    link.setAttribute('href', '/upsell');
    const span = document.createElement('span');
    link.appendChild(span);
    document.getElementById('host')!.appendChild(link);
    span.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(href('#fresh')).toBe('/upsell?fbclid=abc');
  });

  it('adds the params as hidden fields on a GET form, where the action query is discarded', async () => {
    await start('/lp?fbclid=abc', '<form id="f" method="get" action="/search"><input name="q" /></form>');
    const fields = Array.from(document.querySelectorAll('#f input[data-autonnel-param]'));
    expect(fields.map((el) => [el.getAttribute('name'), (el as HTMLInputElement).value])).toEqual([['fbclid', 'abc']]);
  });

  it('leaves POST forms and existing controls alone', async () => {
    await start('/lp?fbclid=abc&q=x', '<form id="p" method="post"></form><form id="g" method="get"><input name="q" /></form>');
    expect(document.querySelectorAll('#p input[data-autonnel-param]')).toHaveLength(0);
    const names = Array.from(document.querySelectorAll('#g input[data-autonnel-param]')).map((el) =>
      el.getAttribute('name'),
    );
    expect(names).toEqual(['fbclid']);
  });

  it('folds the SSR-injected funnel context into every link', async () => {
    await start('/lp', '<a id="a" href="/checkout">Buy</a>', { funnelId: 'f1' });
    expect(href('#a')).toBe('/checkout?funnelId=f1');
  });

  it('stamps the params onto link-bearing data attributes on non-anchor elements', async () => {
    await start('/lp?fbclid=abc', `
      <div id="card" data-url="https://www.taiora.com/cart/1:1" data-img="https://cdn.x.com/a.webp"></div>
      <div id="btn" data-href="/checkout" data-link="/lp2" data-target-url="/t"
           data-checkout-url="/c" data-buy-url="/b"></div>
    `);
    expect(attr('#card', 'data-url')).toBe('https://www.taiora.com/cart/1:1?fbclid=abc');
    expect(attr('#card', 'data-img')).toBe('https://cdn.x.com/a.webp');
    expect(attr('#btn', 'data-href')).toBe('/checkout?fbclid=abc');
    expect(attr('#btn', 'data-link')).toBe('/lp2?fbclid=abc');
    expect(attr('#btn', 'data-target-url')).toBe('/t?fbclid=abc');
    expect(attr('#btn', 'data-checkout-url')).toBe('/c?fbclid=abc');
    expect(attr('#btn', 'data-buy-url')).toBe('/b?fbclid=abc');
  });

  it('drops the identity and depth-marker params from data attributes too', async () => {
    await start('/lp?anid=v1&goid=old&_ad=40&gclid=g', '<div id="c" data-url="/checkout"></div>');
    expect(attr('#c', 'data-url')).toBe('/checkout?gclid=g');
  });

  it('decorates a data-url an island renders after hydration', async () => {
    await start('/lp?fbclid=abc', '<div id="island"></div>');
    document.getElementById('island')!.innerHTML = '<div id="late" data-url="/upsell"></div>';
    await settle();
    expect(attr('#late', 'data-url')).toBe('/upsell?fbclid=abc');
  });

  it('re-decorates a data-url that a re-render reset', async () => {
    await start('/lp?fbclid=abc', '<div id="c" data-url="/checkout"></div>');
    document.querySelector('#c')!.setAttribute('data-url', '/checkout');
    await settle();
    expect(attr('#c', 'data-url')).toBe('/checkout?fbclid=abc');
  });

  it('decorates a data-url created and clicked before the observer catches up', async () => {
    await start('/lp?fbclid=abc', '<div id="host"></div>');
    const card = document.createElement('div');
    card.id = 'fresh';
    card.setAttribute('data-url', '/upsell');
    const span = document.createElement('span');
    card.appendChild(span);
    document.getElementById('host')!.appendChild(card);
    span.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(attr('#fresh', 'data-url')).toBe('/upsell?fbclid=abc');
  });

  it('never appends a param twice to a data attribute', async () => {
    await start('/lp?fbclid=abc', '<div id="c" data-url="/checkout?fbclid=abc"></div>');
    document.querySelector('#c')!.setAttribute('data-url', '/checkout?fbclid=abc');
    await settle();
    expect(attr('#c', 'data-url')).toBe('/checkout?fbclid=abc');
  });

  it('leaves non-navigational data attribute values alone', async () => {
    await start('/lp?fbclid=abc', '<div id="c" data-url="#top" data-href="mailto:a@b.c"></div>');
    expect(attr('#c', 'data-url')).toBe('#top');
    expect(attr('#c', 'data-href')).toBe('mailto:a@b.c');
  });

  it('does nothing when the page carries no params to forward', async () => {
    await start('/lp', '<a id="a" href="/checkout">Buy</a>');
    document.body.insertAdjacentHTML('beforeend', '<a id="late" href="/upsell">Add</a>');
    await settle();
    expect(href('#a')).toBe('/checkout');
    expect(href('#late')).toBe('/upsell');
  });

  it('leaves data attributes alone when the page carries no params', async () => {
    await start('/lp', '<div id="c" data-url="/checkout"></div>');
    expect(attr('#c', 'data-url')).toBe('/checkout');
  });
});
