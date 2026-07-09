import { describe, it, expect } from 'vitest';
import { StaticFeatureCatalog, FEATURES } from './feature-catalog';

describe('StaticFeatureCatalog', () => {
  it('exposes a frozen, non-empty set of FEATURES keys', () => {
    const catalog = new StaticFeatureCatalog();
    expect(catalog.allKeys().size).toBeGreaterThan(0);
    expect(catalog.allKeys().has('ORDERS')).toBe(true);
    expect(catalog.allKeys().has('SETTINGS')).toBe(true);
    expect(Object.isFrozen(FEATURES)).toBe(true);
  });

  it('every key matches the FeatureKey format', () => {
    for (const key of new StaticFeatureCatalog().allKeys()) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
