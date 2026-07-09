import { describe, it, expect } from 'vitest';
import { ApiClientCredential, ApiKeyStatus } from './api-client-credential';
import { PermissionSet } from './permission-set';
import { toFeatureKey } from './feature-key';

describe('ApiClientCredential', () => {
  it('active key exposes its fixed scope permissions', () => {
    const k = ApiClientCredential.rehydrate({
      id: 'k1', prefix: 'ak_abc', status: ApiKeyStatus.Active,
      scope: PermissionSet.of([toFeatureKey('ORDERS')]), writeAccess: true, expiresAt: null,
    });
    expect(k.effectivePermissions(new Date()).has(toFeatureKey('ORDERS'))).toBe(true);
  });

  it('revoked/expired key yields an empty PermissionSet immediately', () => {
    const revoked = ApiClientCredential.rehydrate({
      id: 'k1', prefix: 'ak_abc', status: ApiKeyStatus.Revoked,
      scope: PermissionSet.of([toFeatureKey('ORDERS')]), writeAccess: true, expiresAt: null,
    });
    expect(revoked.effectivePermissions(new Date()).toArray()).toEqual([]);

    const expired = ApiClientCredential.rehydrate({
      id: 'k2', prefix: 'ak_xyz', status: ApiKeyStatus.Active,
      scope: PermissionSet.of([toFeatureKey('ORDERS')]), writeAccess: false,
      expiresAt: new Date('2000-01-01T00:00:00Z'),
    });
    expect(expired.effectivePermissions(new Date()).toArray()).toEqual([]);
  });
});
