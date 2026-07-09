import { describe, it, expect, vi } from 'vitest';
import { OssHostTenantResolver, DomainTableHostTenantResolver } from './host-tenant-resolver';
import { DEFAULT_TENANT, toTenantId } from '../../shared-kernel/tenant-id';

describe('Host tenant resolvers', () => {
  it('OSS resolver always returns DEFAULT_TENANT', async () => {
    const r = new OssHostTenantResolver();
    expect(await r.resolveFromHost('shop.example.com')).toBe(DEFAULT_TENANT);
    expect(await r.resolveFromHost(null)).toBe(DEFAULT_TENANT);
  });

  it('Domain-table resolver maps a known host to its tenant, null otherwise', async () => {
    const lookup = vi.fn(async (host: string) => (host === 'shop.example.com' ? toTenantId('t_shop') : null));
    const r = new DomainTableHostTenantResolver(lookup);
    expect(await r.resolveFromHost('shop.example.com')).toBe('t_shop');
    expect(await r.resolveFromHost('unknown.com')).toBeNull();
  });
});
