import { describe, it, expect, beforeEach } from 'vitest';
import { registerHooks, getHook, getAllHooks, resetHooks } from '@/lib/hooks/hooks';
import { resetTenantResolver, resolveTenant } from '@/lib/tenant/resolver';

describe('hooks registry', () => {
  beforeEach(() => {
    resetHooks();
    resetTenantResolver();
  });

  it('starts with no registered hooks', () => {
    expect(getHook('onOrderCreated')).toBeUndefined();
    expect(getHook('resolveTenant')).toBeUndefined();
    expect(getAllHooks()).toEqual({});
  });

  it('registers and retrieves a hook', () => {
    const fn = async () => undefined;
    registerHooks({ onOrderCreated: fn });
    expect(getHook('onOrderCreated')).toBe(fn);
  });

  it('merges partials across multiple registerHooks calls', () => {
    const a = async () => undefined;
    const cfg = async (id: string) => ({ id });
    registerHooks({ onOrderCreated: a });
    registerHooks({ getTenantConfig: cfg });

    expect(getHook('onOrderCreated')).toBe(a);
    expect(getHook('getTenantConfig')).toBe(cfg);
  });

  it('overwrites previously registered hooks of the same name', () => {
    const a = async () => undefined;
    const b = async () => undefined;
    registerHooks({ onOrderCreated: a });
    registerHooks({ onOrderCreated: b });

    expect(getHook('onOrderCreated')).toBe(b);
  });

  it('routes resolveTenant hook through the tenant resolver', async () => {
    registerHooks({
      resolveTenant: () => ({ id: 'from-hook' }),
    });

    const tenant = await resolveTenant(new Request('http://x/'));
    expect(tenant.id).toBe('from-hook');
  });

  it('exposes getTenantConfig and getAllTenantIds slots', () => {
    const cfg = async (id: string) => ({ id });
    const ids = async () => ['a', 'b'];
    registerHooks({ getTenantConfig: cfg, getAllTenantIds: ids });

    expect(getHook('getTenantConfig')).toBe(cfg);
    expect(getHook('getAllTenantIds')).toBe(ids);
  });
});
