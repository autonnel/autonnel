import { describe, it, expect, vi } from 'vitest';
import { ApiAuthenticationService } from './api-authentication-service';
import { ApiClientCredential, ApiKeyStatus } from '../domain/api-client-credential';
import { PermissionSet } from '../domain/permission-set';
import { toFeatureKey } from '../domain/feature-key';
import { toTenantId } from '../../shared-kernel/tenant-id';

function deps(status = ApiKeyStatus.Active) {
  const credential = ApiClientCredential.rehydrate({
    id: 'k1', prefix: 'ak_abc', status,
    scope: PermissionSet.of([toFeatureKey('ORDERS')]), writeAccess: true, expiresAt: null,
  });
  return {
    repo: { findByHashGlobal: vi.fn().mockResolvedValue({ credential, tenantId: toTenantId('t1') }), listByTenant: vi.fn(), save: vi.fn() },
    secrets: { generatePlaintext: vi.fn(), hashSecret: vi.fn().mockResolvedValue('HASH'), constantTimeEquals: vi.fn() },
    clock: { now: () => new Date('2026-06-04T00:00:00Z') },
  };
}

describe('ApiAuthenticationService', () => {
  it('resolves a Bearer key to an ApiClientPrincipal with its fixed tenant + scope', async () => {
    const d = deps();
    const svc = new ApiAuthenticationService(d.repo as any, d.secrets as any, d.clock as any);
    const p = await svc.authenticate('Bearer ak_abc.secret');
    expect(p?.kind).toBe('apiClient');
    expect(p?.tenantId).toBe('t1');
    expect(p?.writeAccess).toBe(true);
    expect(p?.permissions.has(toFeatureKey('ORDERS'))).toBe(true);
    expect(d.secrets.hashSecret).toHaveBeenCalledWith('ak_abc.secret');
  });

  it('returns null for a missing/garbage Authorization header', async () => {
    const d = deps();
    const svc = new ApiAuthenticationService(d.repo as any, d.secrets as any, d.clock as any);
    expect(await svc.authenticate(null)).toBeNull();
    expect(await svc.authenticate('Basic xyz')).toBeNull();
  });

  it('revoked key yields empty permissions (still an ApiClientPrincipal, but denies all)', async () => {
    const d = deps(ApiKeyStatus.Revoked);
    const svc = new ApiAuthenticationService(d.repo as any, d.secrets as any, d.clock as any);
    const p = await svc.authenticate('Bearer ak_abc.secret');
    expect(p?.permissions.toArray()).toEqual([]);
  });
});
