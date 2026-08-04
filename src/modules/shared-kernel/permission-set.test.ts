import { describe, it, expect } from 'vitest';
import { PermissionSet } from './permission-set';
import { toFeatureKey } from './feature-key';

const k = (s: string) => toFeatureKey(s);

describe('PermissionSet.intersect', () => {
  it('keeps only keys present in both sets', () => {
    const a = PermissionSet.of([k('ORDERS'), k('PAGES'), k('API_KEYS')]);
    const b = PermissionSet.of([k('PAGES'), k('API_KEYS'), k('PERMISSIONS')]);
    expect(a.intersect(b).toArray().sort()).toEqual([k('API_KEYS'), k('PAGES')].sort());
  });

  it('returns empty when the other set is empty', () => {
    const a = PermissionSet.of([k('ORDERS')]);
    expect(a.intersect(PermissionSet.empty()).toArray()).toEqual([]);
  });

  it('does not mutate either operand', () => {
    const a = PermissionSet.of([k('ORDERS'), k('PAGES')]);
    const b = PermissionSet.of([k('PAGES')]);
    a.intersect(b);
    expect(a.toArray().length).toBe(2);
    expect(b.toArray().length).toBe(1);
  });
});
