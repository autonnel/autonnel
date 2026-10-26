import { describe, it, expect, vi } from 'vitest';
import { runWithTenant } from '../../../../lib/tenant/context';
import { PrismaAdCreativeRepository } from './creative.repository';

function fakeDelegate() {
  const rows = new Map<string, any>();
  return {
    rows,
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const key = `${where.tenantId_connectionId_externalAdId.connectionId}:${where.tenantId_connectionId_externalAdId.externalAdId}`;
      const existing = rows.get(key);
      rows.set(key, existing ? { ...existing, ...update } : { ...create });
      return rows.get(key);
    }),
    findMany: vi.fn(async () => [...rows.values()]),
    findFirst: vi.fn(async ({ where }: any) => rows.get([...rows.keys()].find((k) => rows.get(k).id === where.id) ?? '') ?? null),
    update: vi.fn(async ({ where, data }: any) => {
      const key = [...rows.keys()].find((k) => rows.get(k).id === where.id)!;
      rows.set(key, { ...rows.get(key), ...data });
      return rows.get(key);
    }),
  };
}

const row = {
  externalAdId: 'ad-1',
  name: 'Ad One',
  status: 'ACTIVE',
  campaignExternalId: 'c-1',
  campaignName: 'Camp',
  adsetExternalId: null,
  adsetName: null,
  destinationUrl: 'https://x.com/lp',
  normalizedPath: '/lp',
  autoFunnelId: 'funnel-a',
  matchState: 'MATCHED' as const,
  lastSeenAt: new Date('2026-09-12T00:00:00Z'),
};

describe('PrismaAdCreativeRepository.upsertMany', () => {
  it('returns externalAdId -> creativeId so metrics can be written in the same pass', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdCreativeRepository(d as never, () => 'id-1');
      const map = await repo.upsertMany('conn-1', 'META', [row]);
      expect(map.get('ad-1')).toBe('id-1');
    });
  });

  it('passes an explicit tenant id in the composite where, because the prisma tenant extension only injects tenantId into create', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdCreativeRepository(d as never, () => 'id-1');
      await repo.upsertMany('conn-1', 'META', [row]);
      const call = d.upsert.mock.calls[0][0] as any;
      expect(call.where.tenantId_connectionId_externalAdId.tenantId).toBe('default');
      expect(call.where.tenantId_connectionId_externalAdId.connectionId).toBe('conn-1');
      expect(call.where.tenantId_connectionId_externalAdId.externalAdId).toBe('ad-1');
    });
  });

  it('never writes manualFunnelId, so an operator assignment survives every resync', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdCreativeRepository(d as never, () => 'id-1');
      await repo.upsertMany('conn-1', 'META', [row]);
      const call = d.upsert.mock.calls[0][0] as any;
      expect(call.update).not.toHaveProperty('manualFunnelId');
      expect(call.create.manualFunnelId).toBeNull();
    });
  });

  it('refreshes the attribution fields on update so a changed destination URL re-attributes', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdCreativeRepository(d as never, () => 'id-1');
      await repo.upsertMany('conn-1', 'META', [row]);
      const call = d.upsert.mock.calls[0][0] as any;
      expect(call.update.normalizedPath).toBe('/lp');
      expect(call.update.autoFunnelId).toBe('funnel-a');
      expect(call.update.matchState).toBe('MATCHED');
    });
  });
});
