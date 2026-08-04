import { describe, it, expect, vi } from 'vitest';
import { ManageDomainsService, DomainConflictError } from './manage-domains.service';

function repo(overrides: Record<string, unknown> = {}) {
  // The first domain of a tenant is promoted to primary, so setPrimary must echo the created row
  // rather than a placeholder — otherwise the happy path asserts on the wrong host.
  let lastCreated = { id: 'd1', tenantId: 'tenant-a', host: '', isPrimary: false };
  return {
    list: async () => [],
    findById: async () => null,
    findByHost: async () => null,
    findByHostAcrossTenants: async () => null,
    create: async (d: { host: string }) => {
      lastCreated = { id: 'd1', tenantId: 'tenant-a', host: d.host, isPrimary: false };
      return lastCreated;
    },
    setPrimary: async () => ({ ...lastCreated, isPrimary: true }),
    delete: async () => {},
    ...overrides,
  } as never;
}

describe('ManageDomainsService.add — host uniqueness', () => {
  it('rejects a host already claimed by ANOTHER tenant', async () => {
    const create = vi.fn();
    const service = new ManageDomainsService(
      repo({ findByHostAcrossTenants: async () => ({ tenantId: 'tenant-b' }), create }),
      () => 'tenant-a',
    );
    await expect(service.add({ host: 'shop.example.com' })).rejects.toThrow(DomainConflictError);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a host already claimed by THIS tenant', async () => {
    const create = vi.fn();
    const service = new ManageDomainsService(
      repo({ findByHostAcrossTenants: async () => ({ tenantId: 'tenant-a' }), create }),
      () => 'tenant-a',
    );
    await expect(service.add({ host: 'shop.example.com' })).rejects.toThrow(DomainConflictError);
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts an unclaimed host', async () => {
    const service = new ManageDomainsService(repo(), () => 'tenant-a');
    const created = await service.add({ host: 'new.example.com' });
    expect(created.host).toBe('new.example.com');
  });

  it('maps a persistence-level unique violation to DomainConflictError', async () => {
    const service = new ManageDomainsService(
      repo({
        create: async () => {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        },
      }),
      () => 'tenant-a',
    );
    await expect(service.add({ host: 'raced.example.com' })).rejects.toThrow(DomainConflictError);
  });

  it('rethrows a non-uniqueness persistence error unchanged', async () => {
    const service = new ManageDomainsService(
      repo({
        create: async () => {
          throw new Error('connection reset');
        },
      }),
      () => 'tenant-a',
    );
    await expect(service.add({ host: 'x.example.com' })).rejects.toThrow('connection reset');
  });
});
