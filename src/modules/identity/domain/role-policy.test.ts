import { describe, it, expect } from 'vitest';
import { RolePolicy } from './role-policy';
import { toFeatureKey } from './feature-key';

const KNOWN = new Set(['ORDERS', 'PAYMENT', 'SETTINGS']);

describe('RolePolicy', () => {
  it('grant ignores unknown FEATURES keys (never errors)', () => {
    const r = RolePolicy.create({ id: 'r1', name: 'editor', isSystem: false, grants: [] });
    r.setGrants(['ORDERS', 'UNKNOWN_FEATURE'], KNOWN);
    expect(r.grants().map(String).sort()).toEqual(['ORDERS']);
  });

  it('system roles are immutable below baseline (cannot edit grants)', () => {
    const sys = RolePolicy.create({ id: 'admin', name: 'admin', isSystem: true, grants: [toFeatureKey('ORDERS')] });
    expect(() => sys.setGrants(['PAYMENT'], KNOWN)).toThrow(/system/i);
  });

  it('role name must be present', () => {
    expect(() => RolePolicy.create({ id: 'r', name: '', isSystem: false, grants: [] })).toThrow(/name/i);
  });
});
