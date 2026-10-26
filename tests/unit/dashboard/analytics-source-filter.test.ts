import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  transactionFindMany: vi.fn(),
  orderFindMany: vi.fn(),
  queryVisitorCount: vi.fn(),
  queryVisitorBuckets: vi.fn(),
  queryStepVisitorCounts: vi.fn(),
  queryCustomEventCountsByStep: vi.fn(),
  queryVisitorSourceRows: vi.fn(),
  queryAttributedOrders: vi.fn(),
  queryMethodChargesByVisitor: vi.fn(),
}));

vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => ({
    transaction: { findMany: h.transactionFindMany },
    order: { findMany: h.orderFindMany },
    funnel: { findMany: vi.fn() },
  }),
}));
vi.mock('@/lib/dashboard/funnel-stats-queries', () => ({
  queryVisitorCount: h.queryVisitorCount,
  queryVisitorBuckets: h.queryVisitorBuckets,
  queryStepVisitorCounts: h.queryStepVisitorCounts,
  queryCustomEventCountsByStep: h.queryCustomEventCountsByStep,
  queryVisitorSourceRows: h.queryVisitorSourceRows,
  queryAttributedOrders: h.queryAttributedOrders,
  queryMethodChargesByVisitor: h.queryMethodChargesByVisitor,
}));

import {
  loadSourceVisitorIds,
  loadFunnelSteps,
  loadMethodStats,
  loadAnalyticsKpi,
} from '@/lib/dashboard/analytics-data';
import { resolveAnalyticsWindow, RENDERABLE_STEP_DB_TYPES } from '@/lib/dashboard/analytics-helpers';

const window = resolveAnalyticsWindow({ range: '24h', now: new Date('2026-01-10T00:00:00Z') });

beforeEach(() => {
  vi.clearAllMocks();
  h.queryVisitorCount.mockResolvedValue(0);
  h.queryVisitorBuckets.mockResolvedValue([]);
  h.queryStepVisitorCounts.mockResolvedValue([]);
  h.queryCustomEventCountsByStep.mockResolvedValue([]);
  h.queryAttributedOrders.mockResolvedValue([]);
  h.queryMethodChargesByVisitor.mockResolvedValue([]);
  h.transactionFindMany.mockResolvedValue([]);
  h.orderFindMany.mockResolvedValue([]);
});

describe('loadSourceVisitorIds', () => {
  it('keeps only visitors whose entry view matches the source', async () => {
    h.queryVisitorSourceRows.mockResolvedValue([
      { visitorId: 'v_fb', url: 'https://shop.test/lp?fbclid=abc', metadata: null, occurredAt: new Date() },
      { visitorId: 'v_tt', url: 'https://shop.test/lp?ttclid=xyz', metadata: null, occurredAt: new Date() },
      { visitorId: 'v_meta', url: '/lp', metadata: { clickIds: { fbclid: 'def' } }, occurredAt: new Date() },
      { visitorId: 'v_none', url: 'https://shop.test/lp', metadata: null, occurredAt: new Date() },
    ]);

    const ids = await loadSourceVisitorIds({
      funnelId: 'f1',
      source: 'FACEBOOK',
      start: window.prevStart,
      end: window.end,
    });

    expect(ids).toEqual(['v_fb', 'v_meta']);
  });

  it('resolves UNKNOWN for visitors with no source markers', async () => {
    h.queryVisitorSourceRows.mockResolvedValue([
      { visitorId: 'v_fb', url: 'https://shop.test/lp?fbclid=abc', metadata: null, occurredAt: new Date() },
      { visitorId: 'v_none', url: 'https://shop.test/lp', metadata: null, occurredAt: new Date() },
    ]);

    const ids = await loadSourceVisitorIds({
      funnelId: null,
      source: 'UNKNOWN',
      start: window.prevStart,
      end: window.end,
    });

    expect(ids).toEqual(['v_none']);
    // no funnel selected -> the source map must span non-funnel page views too
    expect(h.queryVisitorSourceRows).toHaveBeenCalledWith(null, window.prevStart, window.end, true);
  });
});

describe('visitorIds pass-through', () => {
  it('scopes funnel steps to the visitor set', async () => {
    await loadFunnelSteps({ funnelId: 'f1', window, visitorIds: ['v1', 'v2'] });
    expect(h.queryStepVisitorCounts).toHaveBeenCalledWith('f1', window.start, window.end, ['v1', 'v2']);
    expect(h.queryCustomEventCountsByStep).toHaveBeenCalledWith(
      'f1',
      window.start,
      window.end,
      ['v1', 'v2'],
      RENDERABLE_STEP_DB_TYPES,
    );
  });

  it('scopes KPI orders by attributed visitor even with no funnel selected', async () => {
    await loadAnalyticsKpi({ funnelId: null, window, visitorIds: ['v1'] });
    expect(h.orderFindMany).not.toHaveBeenCalled();
    expect(h.queryAttributedOrders).toHaveBeenCalledWith(null, window.prevStart, window.end, {
      visitorIds: ['v1'],
      allTraffic: true,
    });
  });

  it('joins charges back to orders only when a visitor set is given', async () => {
    await loadMethodStats({ funnelId: null, window });
    expect(h.transactionFindMany).toHaveBeenCalled();
    expect(h.queryMethodChargesByVisitor).not.toHaveBeenCalled();

    await loadMethodStats({ funnelId: null, window, visitorIds: ['v1'] });
    expect(h.queryMethodChargesByVisitor).toHaveBeenCalledWith(window.start, window.end, ['v1']);
  });
});
