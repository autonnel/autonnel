import { describe, it, expect } from 'vitest';
import { runWithTenant } from '@/lib/tenant/context';
import type { PageEngagementRow } from '../../application/ports/outbound';
import { PrismaPageEngagementStore } from './page-engagement.repository';

const ROW: PageEngagementRow = {
  visitorId: 'v1',
  sessionId: 's1',
  pageId: 'p1',
  funnelId: 'f1',
  stepId: 'checkout',
  dwellMs: 30_000,
  activeMs: 12_000,
  maxScrollPct: 60,
  exitScrollPct: 55,
  viewportPct: 5,
  dwellByDepth: [1, 2, 3],
  interactions: ['3:cta'],
  occurredAt: new Date('2026-09-01T00:00:00Z'),
};

interface Captured {
  findUnique: any[];
  upsert: any[];
}

function fakeDelegate(existing: { dwellMs: number; interactions: string[] } | null) {
  const captured: Captured = { findUnique: [], upsert: [] };
  const delegate = {
    async findUnique(args: unknown) {
      captured.findUnique.push(args);
      return existing;
    },
    async upsert(args: unknown) {
      captured.upsert.push(args);
      return null;
    },
  };
  return { delegate, captured };
}

function compoundWhere(args: any) {
  return args.where.tenantId_visitorId_sessionId_pageId;
}

describe('PrismaPageEngagementStore', () => {
  it('scopes findUnique to the current tenant via the compound key', async () => {
    const { delegate, captured } = fakeDelegate(null);
    await runWithTenant('t_1', () => new PrismaPageEngagementStore(delegate).upsertEngagement(ROW));

    const where = compoundWhere(captured.findUnique[0]);
    expect(where).toEqual({ tenantId: 't_1', visitorId: 'v1', sessionId: 's1', pageId: 'p1' });
  });

  it('scopes upsert where to the current tenant when no row exists', async () => {
    const { delegate, captured } = fakeDelegate(null);
    await runWithTenant('t_2', () => new PrismaPageEngagementStore(delegate).upsertEngagement(ROW));

    const where = compoundWhere(captured.upsert[0]);
    expect(where.tenantId).toBe('t_2');
    expect(where.visitorId).toBe('v1');
    expect(where.sessionId).toBe('s1');
    expect(where.pageId).toBe('p1');
  });

  it('when the existing visit is longer, updates only the unioned interactions, leaving its scalars in place', async () => {
    const existing = { dwellMs: 60_000, interactions: ['1:cta'] };
    const { delegate, captured } = fakeDelegate(existing);
    await runWithTenant('t_3', () => new PrismaPageEngagementStore(delegate).upsertEngagement(ROW));

    const update = captured.upsert[0].update;
    expect(Object.keys(update)).toEqual(['interactions']);
    expect(new Set(update.interactions)).toEqual(new Set(['1:cta', '3:cta']));
    expect(compoundWhere(captured.upsert[0]).tenantId).toBe('t_3');
  });

  it('when the new visit is longer, the update carries the new row scalars', async () => {
    const existing = { dwellMs: 1_000, interactions: ['1:cta'] };
    const { delegate, captured } = fakeDelegate(existing);
    await runWithTenant('t_4', () => new PrismaPageEngagementStore(delegate).upsertEngagement(ROW));

    const update = captured.upsert[0].update;
    expect(update.dwellMs).toBe(ROW.dwellMs);
    expect(update.maxScrollPct).toBe(ROW.maxScrollPct);
    expect(update.exitScrollPct).toBe(ROW.exitScrollPct);
    expect(update.viewportPct).toBe(ROW.viewportPct);
    expect(update.dwellByDepth).toEqual(ROW.dwellByDepth);
  });

  it('unions interactions rather than replacing them, on the existing-wins path', async () => {
    const existing = { dwellMs: 60_000, interactions: ['1:cta', '2:expand'] };
    const { delegate, captured } = fakeDelegate(existing);
    await runWithTenant('t_5', () => new PrismaPageEngagementStore(delegate).upsertEngagement(ROW));

    const interactions: string[] = captured.upsert[0].update.interactions;
    expect(new Set(interactions)).toEqual(new Set(['1:cta', '2:expand', '3:cta']));
  });

  it('unions interactions rather than replacing them, on the new-row-wins path', async () => {
    const existing = { dwellMs: 1_000, interactions: ['1:cta', '2:expand'] };
    const { delegate, captured } = fakeDelegate(existing);
    await runWithTenant('t_6', () => new PrismaPageEngagementStore(delegate).upsertEngagement(ROW));

    const interactions: string[] = captured.upsert[0].update.interactions;
    expect(new Set(interactions)).toEqual(new Set(['1:cta', '2:expand', '3:cta']));
  });

  it('deduplicates the interaction union', async () => {
    const existing = { dwellMs: 60_000, interactions: ['3:cta', '1:cta'] };
    const { delegate, captured } = fakeDelegate(existing);
    await runWithTenant('t_7', () => new PrismaPageEngagementStore(delegate).upsertEngagement(ROW));

    const interactions: string[] = captured.upsert[0].update.interactions;
    expect(interactions.length).toBe(2);
    expect(new Set(interactions)).toEqual(new Set(['3:cta', '1:cta']));
  });
});
