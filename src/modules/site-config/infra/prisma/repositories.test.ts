import { describe, it, expect, vi } from 'vitest';
import { PrismaDomainRepository } from './domain.repository';
import { PrismaGlobalScriptRepository } from './global-script.repository';
import { Domain } from '../../domain/domain';
import { GlobalScript } from '../../domain/global-script';

describe('PrismaDomainRepository', () => {
  it('maps rows to Domain and lists them', async () => {
    const prisma = {
      domain: {
        findMany: vi.fn().mockResolvedValue([{ id: 'd1', tenantId: 't1', host: 'a.com', isPrimary: true }]),
      },
    };
    const repo = new PrismaDomainRepository(prisma as never);
    const out = await repo.list();
    expect(out[0]).toBeInstanceOf(Domain);
    expect(out[0].host).toBe('a.com');
  });

  it('setPrimary clears other flags then sets the target', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({ id: 'd2', tenantId: 't1', host: 'b.com', isPrimary: true });
    const repo = new PrismaDomainRepository({ domain: { updateMany, update } } as never);
    const out = await repo.setPrimary('d2');
    expect(updateMany).toHaveBeenCalledWith({ where: { isPrimary: true }, data: { isPrimary: false } });
    expect(out.isPrimary).toBe(true);
  });
});

describe('PrismaGlobalScriptRepository', () => {
  it('maps create row back to GlobalScript', async () => {
    const row = { id: 's1', tenantId: 't1', name: 'GA', content: '<s/>', position: 'HEAD', enabled: true, order: 0 };
    const create = vi.fn().mockResolvedValue(row);
    const repo = new PrismaGlobalScriptRepository({ globalScript: { create } } as never);
    const script = GlobalScript.create({ tenantId: 't1', name: 'GA', content: '<s/>', position: 'HEAD' });
    const saved = await repo.create(script);
    expect(saved).toBeInstanceOf(GlobalScript);
    expect(create).toHaveBeenCalledWith({
      data: { name: 'GA', content: '<s/>', position: 'HEAD', enabled: true, order: 0 },
    });
  });
});
