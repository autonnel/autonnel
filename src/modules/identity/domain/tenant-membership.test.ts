import { describe, it, expect } from 'vitest';
import { TenantMembership, MembershipStatus } from './tenant-membership';
import { PermissionSet } from './permission-set';
import { toFeatureKey } from './feature-key';

describe('TenantMembership', () => {
  it('active membership resolves permissions from assigned roles', () => {
    const m = TenantMembership.rehydrate({ id: 'm1', userId: 'u1', roleIds: ['r1'], status: MembershipStatus.Active });
    const resolved = m.resolvePermissions(PermissionSet.of([toFeatureKey('ORDERS')]));
    expect(resolved.has(toFeatureKey('ORDERS'))).toBe(true);
  });

  it('suspended membership yields an empty PermissionSet regardless of roles', () => {
    const m = TenantMembership.rehydrate({ id: 'm1', userId: 'u1', roleIds: ['r1'], status: MembershipStatus.Suspended });
    const resolved = m.resolvePermissions(PermissionSet.of([toFeatureKey('ORDERS')]));
    expect(resolved.toArray()).toEqual([]);
  });
});
