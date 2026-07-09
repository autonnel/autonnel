import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveTenant,
  setTenantResolver,
  resetTenantResolver,
} from '@/lib/tenant/resolver';
import { DEFAULT_TENANT } from '@/lib/tenant/default';

describe('tenant resolver', () => {
  beforeEach(() => {
    resetTenantResolver();
  });

  it('returns DEFAULT_TENANT by default', async () => {
    const tenant = await resolveTenant(new Request('http://localhost/'));
    expect(tenant).toEqual(DEFAULT_TENANT);
  });

  it('uses a custom resolver when set', async () => {
    setTenantResolver((req) => {
      const host = new URL(req.url).hostname;
      return { id: host === 'acme.example' ? 'acme' : 'default' };
    });

    const acme = await resolveTenant(new Request('http://acme.example/'));
    const other = await resolveTenant(new Request('http://other.example/'));

    expect(acme.id).toBe('acme');
    expect(other.id).toBe('default');
  });

  it('supports async custom resolvers', async () => {
    setTenantResolver(async () => {
      await new Promise((r) => setTimeout(r, 1));
      return { id: 'async-tenant' };
    });

    const tenant = await resolveTenant(new Request('http://localhost/'));
    expect(tenant.id).toBe('async-tenant');
  });

  it('reset reverts to default behaviour', async () => {
    setTenantResolver(() => ({ id: 'custom' }));
    expect((await resolveTenant(new Request('http://x/'))).id).toBe('custom');

    resetTenantResolver();
    expect((await resolveTenant(new Request('http://x/'))).id).toBe('default');
  });
});
