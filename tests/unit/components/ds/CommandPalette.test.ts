import { describe, it, expect } from 'vitest';
import {
  buildPaletteItems,
  filterAndRank,
  groupItems,
  fuzzyScore,
  parseOrderQuery,
  nextIndex,
  __NAV_ITEMS,
  __ACTION_ITEMS,
} from '@/components/primitives/ds/command-palette-helpers';

const SEED = {
  funnels: [
    { id: 'f1', name: 'Black Friday Bundle' },
    { id: 'f2', name: 'Welcome Series' },
    { id: 'f3', name: 'Upsell Path' },
  ],
  sites: [],
};

describe('command-palette helpers — buildPaletteItems', () => {
  it('always emits navigation and action items', () => {
    const items = buildPaletteItems({ funnels: [], sites: [] }, '');
    const navIds = items.filter((i) => i.kind === 'navigate').map((i) => i.id);
    expect(navIds).toEqual(__NAV_ITEMS.map((i) => i.id));
    const actionIds = items.filter((i) => i.kind === 'action').map((i) => i.id);
    expect(actionIds).toEqual(__ACTION_ITEMS.map((i) => i.id));
  });

  it('caps funnels at 10', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `f${i}`, name: `F${i}` }));
    const items = buildPaletteItems({ funnels: many, sites: [] }, '');
    const funnels = items.filter((i) => i.kind === 'funnel');
    expect(funnels).toHaveLength(10);
  });

  it('emits an order item when query looks like an order number', () => {
    const items = buildPaletteItems(SEED, 'A12345');
    const orders = items.filter((i) => i.kind === 'order');
    expect(orders).toHaveLength(1);
    expect(orders[0].href).toContain('/orders?q=A12345');
  });

  it('does not emit order item for very short or symbol queries', () => {
    expect(buildPaletteItems(SEED, 'a').filter((i) => i.kind === 'order')).toHaveLength(0);
    expect(buildPaletteItems(SEED, '!!!').filter((i) => i.kind === 'order')).toHaveLength(0);
  });
});

describe('parseOrderQuery', () => {
  it('returns the trimmed token for valid order-style queries', () => {
    expect(parseOrderQuery('  ord-001  ')).toEqual(['ord-001']);
    expect(parseOrderQuery('A123_456')).toEqual(['A123_456']);
  });
  it('rejects empty or short input', () => {
    expect(parseOrderQuery('')).toEqual([]);
    expect(parseOrderQuery('  ')).toEqual([]);
    expect(parseOrderQuery('ab')).toEqual([]);
  });
  it('rejects queries with non-token characters', () => {
    expect(parseOrderQuery('a b c')).toEqual([]);
    expect(parseOrderQuery('foo@bar')).toEqual([]);
  });
});

describe('fuzzyScore', () => {
  it('returns 1 for empty needle (matches everything)', () => {
    expect(fuzzyScore('anything', '')).toBe(1);
  });
  it('returns 100 for exact match', () => {
    expect(fuzzyScore('orders', 'orders')).toBe(100);
  });
  it('ranks prefix matches above substring matches', () => {
    const prefix = fuzzyScore('orders', 'ord');
    const sub = fuzzyScore('reorders', 'ord');
    expect(prefix).toBeGreaterThan(sub);
  });
  it('returns 0 when characters cannot be ordered', () => {
    expect(fuzzyScore('abc', 'cba')).toBe(0);
  });
  it('case-insensitive', () => {
    expect(fuzzyScore('Orders', 'orders')).toBe(100);
    expect(fuzzyScore('orders', 'ORDERS')).toBe(100);
  });
});

describe('filterAndRank', () => {
  it('returns all items unchanged when query is blank', () => {
    const items = buildPaletteItems(SEED, '');
    expect(filterAndRank(items, '   ')).toEqual(items);
  });

  it('filters out items that do not match the query', () => {
    const items = buildPaletteItems(SEED, '');
    const ranked = filterAndRank(items, 'orders');
    expect(ranked.some((i) => i.label.toLowerCase().includes('orders'))).toBe(true);
    expect(ranked.every((i) => i.kind !== 'site' || i.label.toLowerCase().includes('orders'))).toBe(true);
  });

  it('keeps the best match first', () => {
    const items = buildPaletteItems(SEED, '');
    const ranked = filterAndRank(items, 'overview');
    expect(ranked[0].label.toLowerCase()).toBe('overview');
  });
});

describe('groupItems', () => {
  it('preserves the canonical group order', () => {
    const items = buildPaletteItems(SEED, '');
    const groups = groupItems(items).map((g) => g.group);
    expect(groups).toEqual(['Navigate', 'Funnels', 'Actions']);
  });

  it('omits empty groups', () => {
    const items = buildPaletteItems({ funnels: [], sites: [] }, '');
    const groups = groupItems(items).map((g) => g.group);
    expect(groups).not.toContain('Funnels');
    expect(groups).not.toContain('Sites');
    expect(groups).toContain('Navigate');
    expect(groups).toContain('Actions');
  });

  it('includes Orders group when query looks like an order number', () => {
    const items = buildPaletteItems(SEED, 'XYZ001');
    const groups = groupItems(items).map((g) => g.group);
    expect(groups).toContain('Orders');
  });
});

describe('nextIndex (keyboard wraparound)', () => {
  it('wraps forward past the end', () => {
    expect(nextIndex(2, 3, 1)).toBe(0);
  });
  it('wraps backward before the start', () => {
    expect(nextIndex(0, 3, -1)).toBe(2);
  });
  it('returns 0 when total is 0', () => {
    expect(nextIndex(5, 0, 1)).toBe(0);
  });
  it('moves linearly otherwise', () => {
    expect(nextIndex(1, 4, 1)).toBe(2);
    expect(nextIndex(2, 4, -1)).toBe(1);
  });
});
