import { describe, it, expect, vi } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/commerce-gateway/domain/value-objects/external-ref';
import { Market } from '@/modules/commerce-gateway/domain/value-objects/market';
import { Sellability } from '@/modules/commerce-gateway/domain/value-objects/sellability';
import type { Purchasable } from '@/modules/commerce-gateway/domain/value-objects/purchasable';
import type { StorefrontProductView } from '@/modules/commerce-gateway/application/ports/inbound';
import { buildPreselectedItems, resolvePreselectedItems, type PreselectionDeps } from './storefront-preselection';

const GID = (n: number) => `gid://shopify/ProductVariant/${n}`;

function purchasable(variant: string, product: string, minor: number | null, opts: { currency?: string; sellability?: Sellability } = {}): Purchasable {
  const currency = opts.currency ?? 'USD';
  return {
    productRef: ExternalRef.of(product),
    variantRef: ExternalRef.of(variant),
    title: `${product} title - ${variant}`,
    market: Market.of('US', currency),
    price: minor === null ? undefined : Money.of(minor, currency),
    sellability: opts.sellability ?? Sellability.sellable(),
    mediaRefs: ['https://cdn/p.jpg'],
  };
}

function view(ref: string, variants: Array<{ ref: string; title: string; compare: number | null; currency?: string; thumb?: string | null }>): StorefrontProductView {
  return {
    ref,
    title: 'Glow Serum',
    status: 'active',
    thumbnail: 'https://cdn/product.jpg',
    mediaRefs: [],
    priceMinor: null,
    comparePriceMinor: null,
    currencyCode: 'USD',
    variants: variants.map((v) => ({
      ref: v.ref,
      title: v.title,
      priceMinor: 999,
      comparePriceMinor: v.compare,
      currencyCode: v.currency ?? 'USD',
      thumbnail: v.thumb ?? null,
    })),
  };
}

describe('buildPreselectedItems', () => {
  it('maps purchasables and product views onto SelectedItem rows in request order', () => {
    const purchasables = [purchasable(GID(2), 'P1', 4900), purchasable(GID(1), 'P1', 2900)];
    const views = new Map([
      ['P1', view('P1', [
        { ref: GID(1), title: '1 Bottle', compare: 3900 },
        { ref: GID(2), title: '2 Bottles', compare: 4000, thumb: 'https://cdn/v2.jpg' },
      ])],
    ]);

    const result = buildPreselectedItems(['1', GID(2)], purchasables, views);

    expect(result).toEqual({
      currency: 'USD',
      regionId: 'USD',
      items: [
        {
          id: GID(1),
          productId: 'P1',
          productName: 'Glow Serum',
          variantName: '1 Bottle',
          price: 29,
          comparePrice: 39,
          thumbnail: 'https://cdn/product.jpg',
          quantity: 1,
          currency: 'USD',
        },
        {
          id: GID(2),
          productId: 'P1',
          productName: 'Glow Serum',
          variantName: '2 Bottles',
          price: 49,
          thumbnail: 'https://cdn/v2.jpg',
          quantity: 1,
          currency: 'USD',
        },
      ],
    });
  });

  it('skips unsellable, unpriced and unknown ids', () => {
    const purchasables = [
      purchasable('a', 'P', 1000, { sellability: Sellability.unavailable('out_of_stock') }),
      purchasable('b', 'P', null),
      purchasable('c', 'P', 1500, { sellability: Sellability.unknown('stale_inventory') }),
    ];
    const result = buildPreselectedItems(['a', 'b', 'missing', 'c'], purchasables, new Map());
    expect(result?.items.map((i) => i.id)).toEqual(['c']);
    expect(result?.items[0]).toMatchObject({ productName: 'P title - c', thumbnail: 'https://cdn/p.jpg', price: 15 });
    expect(result?.items[0].variantName).toBeUndefined();
  });

  it('returns null when nothing resolves', () => {
    expect(buildPreselectedItems(['x'], [], new Map())).toBeNull();
  });

  it('keeps a single currency and ignores a compare price in another currency', () => {
    const purchasables = [purchasable('a', 'P', 1000, { currency: 'EUR' }), purchasable('b', 'P', 2000)];
    const views = new Map([['P', view('P', [{ ref: 'a', title: 'Default Title', compare: 5000, currency: 'USD' }])]]);
    const result = buildPreselectedItems(['a', 'b'], purchasables, views);
    expect(result?.currency).toBe('EUR');
    expect(result?.items.map((i) => i.id)).toEqual(['a']);
    expect(result?.items[0].comparePrice).toBeUndefined();
    expect(result?.items[0].variantName).toBeUndefined();
  });
});

describe('resolvePreselectedItems', () => {
  function deps(purchasables: Purchasable[], views: StorefrontProductView[] = []) {
    const resolvePurchasables = vi.fn(async (_query: unknown) => purchasables);
    const getByRef = vi.fn(async (ref: string) => views.find((v) => v.ref === ref) ?? null);
    const loadReadSides = vi.fn(async () => ({ purchasables: { resolvePurchasables }, storefront: { getByRef } }));
    const d: PreselectionDeps = { market: { countryCode: 'DE', currencyCode: 'EUR' }, loadReadSides };
    return { d, resolvePurchasables, getByRef, loadReadSides };
  }

  it('uses the page currency market instead of the default one', async () => {
    const { d, resolvePurchasables, loadReadSides } = deps([purchasable(GID(7), 'P', 1200, { currency: 'EUR' })]);
    d.market = { countryCode: 'US', currencyCode: 'USD' };
    const result = await resolvePreselectedItems('7', d, 'EUR');
    expect(loadReadSides).toHaveBeenCalledWith('DE');
    expect((resolvePurchasables.mock.calls[0][0] as { market: Market }).market.currencyCode).toBe('EUR');
    expect(result?.currency).toBe('EUR');
    expect(result?.items[0].currency).toBe('EUR');
  });

  it('does not preselect a variant without a price in the page currency', async () => {
    const { d } = deps([purchasable(GID(7), 'P', null, { currency: 'EUR' })]);
    expect(await resolvePreselectedItems('7', d, 'EUR')).toBeNull();
  });

  it('returns null without throwing for an unsupported page currency', async () => {
    const { d, loadReadSides } = deps([]);
    expect(await resolvePreselectedItems('7', d, 'XXX')).toBeNull();
    expect(loadReadSides).not.toHaveBeenCalled();
  });

  it('does no lookup without valid ids', async () => {
    const { d, loadReadSides } = deps([]);
    expect(await resolvePreselectedItems(null, d)).toBeNull();
    expect(await resolvePreselectedItems('<x>', d)).toBeNull();
    expect(loadReadSides).not.toHaveBeenCalled();
  });

  it('queries the checkout market with GID candidates and one view per product', async () => {
    const { d, resolvePurchasables, getByRef, loadReadSides } = deps(
      [purchasable(GID(7), 'P', 1200, { currency: 'EUR' }), purchasable(GID(8), 'P', 1300, { currency: 'EUR' })],
      [view('P', [{ ref: GID(7), title: 'Small', compare: null, currency: 'EUR' }])],
    );
    const result = await resolvePreselectedItems('7,8', d);
    expect(loadReadSides).toHaveBeenCalledWith('DE');
    const query = resolvePurchasables.mock.calls[0][0] as { variantRefs: ExternalRef[]; market: Market };
    expect(query.variantRefs.map((r) => r.toString())).toEqual(['7', GID(7), '8', GID(8)]);
    expect(query.market.countryCode).toBe('DE');
    expect(query.market.currencyCode).toBe('EUR');
    expect(getByRef).toHaveBeenCalledTimes(1);
    expect(getByRef).toHaveBeenCalledWith('P', { countryCode: 'DE', currencyCode: 'EUR' });
    expect(result?.items.map((i) => [i.id, i.price, i.variantName])).toEqual([[GID(7), 12, 'Small'], [GID(8), 13, undefined]]);
  });

  it('never throws when the backend is unavailable', async () => {
    const d: PreselectionDeps = {
      market: { countryCode: 'US', currencyCode: 'USD' },
      loadReadSides: async () => {
        throw new Error('commerce backend not configured');
      },
    };
    await expect(resolvePreselectedItems('1', d)).resolves.toBeNull();
  });

  it('still maps rows when a product view lookup fails', async () => {
    const { d, getByRef } = deps([purchasable('a', 'P', 500)]);
    getByRef.mockRejectedValueOnce(new Error('boom'));
    const result = await resolvePreselectedItems('a', d);
    expect(result?.items[0]).toMatchObject({ id: 'a', productName: 'P title - a', price: 5 });
  });
});
