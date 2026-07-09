import { describe, it, expect } from 'vitest';
import { runWithContext } from '../infra/als-tenant-context';
import { getPrincipal, getTenantId, requireFeature } from './principal-resolution';
import { toFeatureKey } from '../domain/feature-key';
import { PermissionSet } from '../domain/permission-set';
import { DEFAULT_TENANT, toTenantId } from '../../shared-kernel/tenant-id';

describe('principal-resolution (in-process)', () => {
  const principal = {
    kind: 'user' as const, userId: 'u1', tenantId: toTenantId('t1'),
    permissions: PermissionSet.of([toFeatureKey('ORDERS')]),
  };

  it('reads tenant + principal from the ambient ALS context', async () => {
    await runWithContext({ tenantId: toTenantId('t1'), principal }, async () => {
      expect(getTenantId()).toBe('t1');
      const resolved = getPrincipal();
      expect(resolved?.kind === 'user' ? resolved.userId : undefined).toBe('u1');
    });
  });

  it('requireFeature passes when granted, throws when missing', async () => {
    await runWithContext({ tenantId: toTenantId('t1'), principal }, async () => {
      expect(() => requireFeature(toFeatureKey('ORDERS'))).not.toThrow();
      expect(() => requireFeature(toFeatureKey('PAYMENT'))).toThrow(/forbidden/i);
    });
  });

  it('outside any context, tenant falls back to DEFAULT_TENANT and principal is null', () => {
    expect(getTenantId()).toBe(DEFAULT_TENANT);
    expect(getPrincipal()).toBeNull();
    expect(() => requireFeature(toFeatureKey('ORDERS'))).toThrow(/forbidden/i);
  });
});
