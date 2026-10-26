import { describe, it, expect, vi } from 'vitest';
import { runWithTenant } from '../../../../lib/tenant/context';
import { PrismaAdDailyMetricRepository } from './daily-metric.repository';

function fakeDelegate() {
  const rows = new Map<string, any>();
  return {
    rows,
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const k = where.tenantId_creativeId_date;
      const key = `${k.tenantId}:${k.creativeId}:${k.date.toISOString()}`;
      const existing = rows.get(key);
      rows.set(key, existing ? { ...existing, ...update } : { ...create });
      return rows.get(key);
    }),
    // Not part of MetricDelegate: kept only to prove the repository never reaches for an
    // insert-style path when a row already exists.
    create: vi.fn(),
    createMany: vi.fn(),
  };
}

function makeRow(overrides: Partial<Parameters<PrismaAdDailyMetricRepository['upsertMany']>[0][number]> = {}) {
  return {
    creativeId: 'creative-1',
    date: '2026-09-12',
    currency: 'USD',
    spendMinor: 1000,
    impressions: 100,
    clicks: 10,
    linkClicks: 8,
    conversions: 2,
    initiateCheckout: 6,
    conversionValueMinor: 5000,
    ...overrides,
  };
}

describe('PrismaAdDailyMetricRepository.upsertMany', () => {
  it('upserts rather than inserts', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdDailyMetricRepository(d as never, () => 'metric-1');
      await repo.upsertMany([makeRow()]);
      expect(d.upsert).toHaveBeenCalledTimes(1);
      expect(d.create).not.toHaveBeenCalled();
      expect(d.createMany).not.toHaveBeenCalled();
    });
  });

  it('passes an explicit tenant id in the composite where, because the prisma tenant extension only injects tenantId into create', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdDailyMetricRepository(d as never, () => 'metric-1');
      await repo.upsertMany([makeRow()]);
      const call = d.upsert.mock.calls[0][0] as any;
      expect(call.where.tenantId_creativeId_date.tenantId).toBe('default');
      expect(call.where.tenantId_creativeId_date.creativeId).toBe('creative-1');
      expect(call.where.tenantId_creativeId_date.date.toISOString()).toBe('2026-09-12T00:00:00.000Z');
    });
  });

  it('overwrites on a second upsert for the same (creativeId, date), since platforms backfill the current day', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdDailyMetricRepository(d as never, () => 'metric-1');
      await repo.upsertMany([makeRow({ spendMinor: 1000 })]);
      await repo.upsertMany([makeRow({ spendMinor: 1500 })]);
      expect(d.upsert).toHaveBeenCalledTimes(2);
      expect(d.rows.size).toBe(1);
      const [stored] = [...d.rows.values()];
      expect(stored.spendMinor).toBe(1500);
    });
  });

  it('returns a count equal to the number of rows written', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdDailyMetricRepository(d as never, () => 'metric-1');
      const written = await repo.upsertMany([
        makeRow({ creativeId: 'creative-1' }),
        makeRow({ creativeId: 'creative-2' }),
      ]);
      expect(written).toBe(2);
    });
  });

  it('round-trips linkClicks, initiateCheckout and conversionValueMinor as null, not 0', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdDailyMetricRepository(d as never, () => 'metric-1');
      await repo.upsertMany([makeRow({ linkClicks: null, initiateCheckout: null, conversionValueMinor: null })]);
      const call = d.upsert.mock.calls[0][0] as any;
      expect(call.create.linkClicks).toBeNull();
      expect(call.create.initiateCheckout).toBeNull();
      expect(call.create.conversionValueMinor).toBeNull();
    });
  });

  it('keeps a fractional conversions value instead of truncating it', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdDailyMetricRepository(d as never, () => 'metric-1');
      await repo.upsertMany([makeRow({ conversions: 3.5 })]);
      const call = d.upsert.mock.calls[0][0] as any;
      expect(call.create.conversions).toBe(3.5);
    });
  });

  it('uses the calendar date given, with no day shift, in both where and create', async () => {
    await runWithTenant('default', async () => {
      const d = fakeDelegate();
      const repo = new PrismaAdDailyMetricRepository(d as never, () => 'metric-1');
      await repo.upsertMany([makeRow({ date: '2026-09-12' })]);
      const call = d.upsert.mock.calls[0][0] as any;
      expect(call.where.tenantId_creativeId_date.date.toISOString()).toBe('2026-09-12T00:00:00.000Z');
      expect(call.create.date.toISOString()).toBe('2026-09-12T00:00:00.000Z');
      expect(call.create.date.getUTCFullYear()).toBe(2026);
      expect(call.create.date.getUTCMonth()).toBe(8);
      expect(call.create.date.getUTCDate()).toBe(12);
    });
  });
});
