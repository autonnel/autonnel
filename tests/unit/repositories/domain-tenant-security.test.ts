import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tenantId: 'tenant-a',
  domain: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: { domain: mocks.domain },
  getBasePrisma: () => ({ domain: mocks.domain }),
}));

vi.mock('@/lib/tenant/context', () => ({
  getCurrentTenantId: () => mocks.tenantId,
}));

import { DomainHostConflictError, PrismaDomainRepository } from '@/lib/repositories/domain.repository';

describe('PrismaDomainRepository tenant security', () => {
  beforeEach(() => {
    mocks.tenantId = 'tenant-a';
    vi.clearAllMocks();
  });

  it('rejects a host already bound to any tenant before creating it', async () => {
    mocks.domain.count.mockResolvedValueOnce(1);
    const repo = new PrismaDomainRepository();

    await expect(repo.create({ host: 'example.com' })).rejects.toBeInstanceOf(DomainHostConflictError);

    expect(mocks.domain.count).toHaveBeenCalledWith({ where: { host: 'example.com' } });
    expect(mocks.domain.create).not.toHaveBeenCalled();
  });

  it('sets primary only after verifying the domain belongs to the current tenant', async () => {
    mocks.domain.findFirst
      .mockResolvedValueOnce({ id: 'd1', tenantId: mocks.tenantId, host: 'example.com' })
      .mockResolvedValueOnce({ id: 'd1', tenantId: mocks.tenantId, host: 'example.com', isPrimary: true });
    mocks.domain.updateMany.mockResolvedValue({ count: 1 });

    const repo = new PrismaDomainRepository();
    await repo.setPrimary('d1');

    expect(mocks.domain.findFirst).toHaveBeenCalledWith({ where: { id: 'd1', tenantId: mocks.tenantId } });
    expect(mocks.domain.updateMany).toHaveBeenCalledWith({
      where: { tenantId: mocks.tenantId, id: 'd1' },
      data: { isPrimary: true },
    });
  });

  it('deletes only within the current tenant', async () => {
    const repo = new PrismaDomainRepository();
    await repo.delete('d1');

    expect(mocks.domain.deleteMany).toHaveBeenCalledWith({ where: { id: 'd1', tenantId: mocks.tenantId } });
  });
});
