import { describe, it, expect } from 'vitest';
import { toFeatureKey } from './feature-key';
import { PermissionSet } from './permission-set';

describe('PermissionSet', () => {
  const ORDERS = toFeatureKey('ORDERS');
  const PAYMENT = toFeatureKey('PAYMENT');
  const SETTINGS = toFeatureKey('SETTINGS');

  it('is immutable and de-dupes keys', () => {
    const set = PermissionSet.of([ORDERS, ORDERS, PAYMENT]);
    expect(set.toArray().sort()).toEqual(['ORDERS', 'PAYMENT']);
  });

  it('has / hasAll / hasAny', () => {
    const set = PermissionSet.of([ORDERS, PAYMENT]);
    expect(set.has(ORDERS)).toBe(true);
    expect(set.has(SETTINGS)).toBe(false);
    expect(set.hasAll([ORDERS, PAYMENT])).toBe(true);
    expect(set.hasAll([ORDERS, SETTINGS])).toBe(false);
    expect(set.hasAny([SETTINGS, PAYMENT])).toBe(true);
    expect(set.hasAny([SETTINGS])).toBe(false);
  });

  it('empty() denies everything (suspended/revoked principals)', () => {
    expect(PermissionSet.empty().has(ORDERS)).toBe(false);
    expect(PermissionSet.empty().toArray()).toEqual([]);
  });

  it('merge unions grants from multiple roles', () => {
    const a = PermissionSet.of([ORDERS]);
    const b = PermissionSet.of([PAYMENT]);
    expect(a.merge(b).toArray().sort()).toEqual(['ORDERS', 'PAYMENT']);
  });
});
