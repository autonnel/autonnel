import { describe, it, expect } from 'vitest';
import {
  MAX_PRESELECTED_VARIANTS,
  parseVariantIds,
  pickPreselectedId,
  variantIdMatches,
  variantRefCandidates,
} from './variant-params';

describe('parseVariantIds', () => {
  it('returns nothing for a missing or empty param', () => {
    expect(parseVariantIds(null)).toEqual([]);
    expect(parseVariantIds(undefined)).toEqual([]);
    expect(parseVariantIds('')).toEqual([]);
    expect(parseVariantIds(' , ,')).toEqual([]);
  });

  it('keeps valid ids in order, trims and dedupes', () => {
    expect(parseVariantIds(' 123 ,abc_DEF-9,123')).toEqual(['123', 'abc_DEF-9']);
  });

  it('accepts Shopify variant GIDs, including Picocart cuid tails', () => {
    expect(parseVariantIds('gid://shopify/ProductVariant/4455,7')).toEqual(['gid://shopify/ProductVariant/4455', '7']);
    expect(parseVariantIds('gid://shopify/ProductVariant/cmv34umkj0005psp7r98dy8lb')).toEqual(['gid://shopify/ProductVariant/cmv34umkj0005psp7r98dy8lb']);
    expect(parseVariantIds('gid://shopify/ProductVariant/a/b,gid://shopify/ProductVariant/')).toEqual([]);
  });

  it('drops ids with unsafe characters or excessive length', () => {
    const tooLong = 'a'.repeat(65);
    expect(parseVariantIds(`<script>,a b,${tooLong},ok,gid://shopify/Product/1,../x`)).toEqual(['ok']);
  });

  it('caps the number of ids', () => {
    const raw = Array.from({ length: 15 }, (_, i) => `v${i}`).join(',');
    const ids = parseVariantIds(raw);
    expect(ids).toHaveLength(MAX_PRESELECTED_VARIANTS);
    expect(ids[0]).toBe('v0');
    expect(ids[MAX_PRESELECTED_VARIANTS - 1]).toBe(`v${MAX_PRESELECTED_VARIANTS - 1}`);
  });
});

describe('variant id matching', () => {
  it('matches exact refs and plain ids against GID tails only', () => {
    expect(variantIdMatches('gid://shopify/ProductVariant/42', 'gid://shopify/ProductVariant/42')).toBe(true);
    expect(variantIdMatches('gid://shopify/ProductVariant/42', '42')).toBe(true);
    expect(variantIdMatches('gid://shopify/ProductVariant/142', '42')).toBe(false);
    expect(variantIdMatches('42', '42')).toBe(true);
    expect(variantIdMatches('x/abc', 'abc')).toBe(false);
    expect(variantIdMatches('gid://shopify/ProductVariant/cmv34umkj', 'cmv34umkj')).toBe(true);
    expect(variantIdMatches('gid://shopify/ProductVariant/xcmv34umkj', 'cmv34umkj')).toBe(false);
    expect(variantIdMatches('gid://shopify/ProductVariant/42', 'gid://shopify/ProductVariant/4')).toBe(false);
  });

  it('expands plain ids to the GID form for lookup', () => {
    expect(variantRefCandidates('42')).toEqual(['42', 'gid://shopify/ProductVariant/42']);
    expect(variantRefCandidates('cmv34umkj')).toEqual(['cmv34umkj', 'gid://shopify/ProductVariant/cmv34umkj']);
    expect(variantRefCandidates('gid://shopify/ProductVariant/42')).toEqual(['gid://shopify/ProductVariant/42']);
  });

  it('picks the first requested id that a configured item matches', () => {
    const items = ['gid://shopify/ProductVariant/1', 'gid://shopify/ProductVariant/2'];
    expect(pickPreselectedId(items, ['9', '2', '1'])).toBe('gid://shopify/ProductVariant/2');
    expect(pickPreselectedId(items, ['9'])).toBeNull();
    expect(pickPreselectedId(items, [])).toBeNull();
  });
});
