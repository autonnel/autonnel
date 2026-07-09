import { describe, it, expect } from 'vitest';
import { TenantContextResolver } from './tenant-context-resolver';
import { DEFAULT_TENANT, toTenantId } from '../../../shared-kernel/tenant-id';

describe('TenantContextResolver', () => {
  const resolver = new TenantContextResolver();

  it('api-key tenant wins over everything', () => {
    const t = resolver.resolve({
      apiKeyTenantId: toTenantId('t_api'),
      sessionActiveTenantId: toTenantId('t_session'),
      hostTenantId: toTenantId('t_host'),
    });
    expect(t).toBe('t_api');
  });

  it('session active tenant wins when no api key', () => {
    const t = resolver.resolve({
      apiKeyTenantId: null,
      sessionActiveTenantId: toTenantId('t_session'),
      hostTenantId: toTenantId('t_host'),
    });
    expect(t).toBe('t_session');
  });

  it('host mapping wins when no api key and no session', () => {
    const t = resolver.resolve({
      apiKeyTenantId: null, sessionActiveTenantId: null, hostTenantId: toTenantId('t_host'),
    });
    expect(t).toBe('t_host');
  });

  it('falls back to OSS DEFAULT_TENANT when nothing resolves', () => {
    const t = resolver.resolve({ apiKeyTenantId: null, sessionActiveTenantId: null, hostTenantId: null });
    expect(t).toBe(DEFAULT_TENANT);
  });
});
