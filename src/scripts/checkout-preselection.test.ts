import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PreselectedItems } from '@/lib/storefront/preselected-items';
import {
  PRODUCTS_SELECTED_EVENT,
  REQUEST_SELECTION_EVENT,
  bindPreselection,
  buildPreselectionDetail,
} from './checkout-preselection';

const PRESELECTED: PreselectedItems = {
  currency: 'USD',
  regionId: 'USD',
  items: [
    { id: 'v1', productId: 'p1', productName: 'Serum', variantName: '1 Bottle', price: 29, quantity: 1, currency: 'USD' },
    { id: 'v2', productId: 'p2', productName: 'Cream', price: 10.5, quantity: 2, currency: 'USD' },
  ],
};

type FakeWindow = EventTarget & { __AUTONNEL_PRESELECTED_ITEMS__?: PreselectedItems | null };

function fakeWindow(preselected: PreselectedItems | null): FakeWindow {
  const win = new EventTarget() as FakeWindow;
  win.__AUTONNEL_PRESELECTED_ITEMS__ = preselected;
  return win;
}

function recordSelections(win: EventTarget) {
  const seen: Array<Record<string, unknown>> = [];
  win.addEventListener(PRODUCTS_SELECTED_EVENT, (e) => seen.push((e as CustomEvent).detail));
  return seen;
}

function broadcastForeign(win: EventTarget, products: unknown[]) {
  win.dispatchEvent(new CustomEvent(PRODUCTS_SELECTED_EVENT, { detail: { products, total: 1, currency: 'USD', userInitiated: false } }));
}

describe('buildPreselectionDetail', () => {
  it('builds the productsSelected contract with userInitiated false', () => {
    expect(buildPreselectionDetail(PRESELECTED)).toEqual({
      products: PRESELECTED.items,
      total: 50,
      currency: 'USD',
      regionId: 'USD',
      userInitiated: false,
    });
  });
});

describe('bindPreselection', () => {
  let win: FakeWindow;
  beforeEach(() => {
    win = fakeWindow(PRESELECTED);
  });

  it('does nothing without preselected items', () => {
    const empty = fakeWindow({ items: [], currency: 'USD' });
    const seen = recordSelections(empty);
    expect(bindPreselection(empty as unknown as Window)).toBe(false);
    empty.dispatchEvent(new CustomEvent(REQUEST_SELECTION_EVENT));
    expect(seen).toHaveLength(0);
    expect(bindPreselection(fakeWindow(null) as unknown as Window)).toBe(false);
  });

  it('broadcasts once on bind and repeats its own selection on every request', () => {
    const seen = recordSelections(win);
    expect(bindPreselection(win as unknown as Window)).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ userInitiated: false, products: PRESELECTED.items });

    win.dispatchEvent(new CustomEvent(REQUEST_SELECTION_EVENT));
    win.dispatchEvent(new CustomEvent(REQUEST_SELECTION_EVENT));
    expect(seen).toHaveLength(3);
    expect(seen.every((d) => d.products === PRESELECTED.items)).toBe(true);
  });

  it('defers for good once a foreign selection appears', () => {
    const seen = recordSelections(win);
    bindPreselection(win as unknown as Window);
    broadcastForeign(win, [{ id: 'other', price: 5 }]);
    win.dispatchEvent(new CustomEvent(REQUEST_SELECTION_EVENT));
    expect(seen).toHaveLength(2);
    expect((seen[1].products as Array<{ id: string }>)[0].id).toBe('other');
  });

  it('defers even when a selector broadcasts the same ids, so its rows win', () => {
    bindPreselection(win as unknown as Window);
    broadcastForeign(win, [{ id: 'v1', price: 29 }]);
    const seen = recordSelections(win);
    win.dispatchEvent(new CustomEvent(REQUEST_SELECTION_EVENT));
    expect(seen).toHaveLength(0);
  });

  it('stays silent when a selector already answered before binding', () => {
    const selector = vi.fn(() => broadcastForeign(win, [{ id: 'sel', price: 1 }]));
    win.addEventListener(REQUEST_SELECTION_EVENT, selector);
    bindPreselection(win as unknown as Window);
    const seen = recordSelections(win);
    win.dispatchEvent(new CustomEvent(REQUEST_SELECTION_EVENT));
    expect(selector).toHaveBeenCalledTimes(1);
    expect(seen.map((d) => (d.products as Array<{ id: string }>)[0].id)).toEqual(['sel']);
  });

  it('ignores an empty foreign selection', () => {
    bindPreselection(win as unknown as Window);
    broadcastForeign(win, []);
    const seen = recordSelections(win);
    win.dispatchEvent(new CustomEvent(REQUEST_SELECTION_EVENT));
    expect(seen).toHaveLength(1);
  });

  it('binds at most once per window', () => {
    const seen = recordSelections(win);
    bindPreselection(win as unknown as Window);
    expect(bindPreselection(win as unknown as Window)).toBe(false);
    win.dispatchEvent(new CustomEvent(REQUEST_SELECTION_EVENT));
    expect(seen).toHaveLength(2);
  });
});
