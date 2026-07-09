import { describe, it, expect } from 'vitest';
import { AuthorizationService } from './authorization-service';
import { LastOwnerGuard } from './last-owner-guard';
import { TenantMembership, MembershipStatus } from '../tenant-membership';
import { RolePolicy } from '../role-policy';
import { toFeatureKey } from '../feature-key';

describe('AuthorizationService', () => {
  const auth = new AuthorizationService();
  const ordersRole = RolePolicy.create({ id: 'r1', name: 'orders', isSystem: false, grants: [toFeatureKey('ORDERS')] });
  const payRole = RolePolicy.create({ id: 'r2', name: 'pay', isSystem: false, grants: [toFeatureKey('PAYMENT')] });

  it('flattens membership roles → union PermissionSet', () => {
    const m = TenantMembership.rehydrate({ id: 'm', userId: 'u', roleIds: ['r1', 'r2'], status: MembershipStatus.Active });
    const set = auth.resolve(m, [ordersRole, payRole]);
    expect(set.toArray().sort()).toEqual(['ORDERS', 'PAYMENT']);
  });

  it('suspended membership → empty set even with roles', () => {
    const m = TenantMembership.rehydrate({ id: 'm', userId: 'u', roleIds: ['r1'], status: MembershipStatus.Suspended });
    expect(auth.resolve(m, [ordersRole]).toArray()).toEqual([]);
  });
});

describe('LastOwnerGuard', () => {
  const guard = new LastOwnerGuard();
  it('forbids removing the last owner-equivalent membership', () => {
    expect(() => guard.assertCanRemove({ ownerMembershipCount: 1, targetIsOwner: true })).toThrow(/last owner/i);
  });
  it('allows removing a non-last owner', () => {
    expect(() => guard.assertCanRemove({ ownerMembershipCount: 2, targetIsOwner: true })).not.toThrow();
  });
  it('allows removing a non-owner', () => {
    expect(() => guard.assertCanRemove({ ownerMembershipCount: 1, targetIsOwner: false })).not.toThrow();
  });
});
