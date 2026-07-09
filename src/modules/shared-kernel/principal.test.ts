import { describe, it, expect } from 'vitest';
import { toFeatureKey } from '../identity/domain/feature-key';
import { PermissionSet } from '../identity/domain/permission-set';
import { isUserPrincipal, isApiClientPrincipal, type Principal } from './principal';
import { toTenantId } from './tenant-id';

describe('Principal', () => {
  const perms = PermissionSet.of([toFeatureKey('ORDERS')]);

  it('narrows UserPrincipal vs ApiClientPrincipal', () => {
    const user: Principal = { kind: 'user', userId: 'u1', tenantId: toTenantId('default'), permissions: perms };
    const api: Principal = { kind: 'apiClient', apiKeyId: 'k1', tenantId: toTenantId('default'), permissions: perms, writeAccess: true };
    expect(isUserPrincipal(user)).toBe(true);
    expect(isApiClientPrincipal(user)).toBe(false);
    expect(isApiClientPrincipal(api)).toBe(true);
  });

  it('exposes the resolved permission set on both kinds', () => {
    const user: Principal = { kind: 'user', userId: 'u1', tenantId: toTenantId('default'), permissions: perms };
    expect(user.permissions.has(toFeatureKey('ORDERS'))).toBe(true);
  });
});
