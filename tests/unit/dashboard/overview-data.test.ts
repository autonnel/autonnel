import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getLastMock: vi.fn(),
  orderFindMany: vi.fn(),
  funnelFindMany: vi.fn(),
  recallAttemptFindMany: vi.fn(),
  queryVisitorCount: vi.fn(),
  queryVisitorSparkline: vi.fn(),
  queryVisitorCountsByFunnel: vi.fn(),
  queryAttributedOrders: vi.fn(),
  queryLatestTrafficAt: vi.fn(),
}));

vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => ({
    order: { findMany: h.orderFindMany },
    funnel: { findMany: h.funnelFindMany },
    recallAttempt: { findMany: h.recallAttemptFindMany },
  }),
}));
vi.mock('@/lib/dashboard/funnel-stats-queries', () => ({
  queryVisitorCount: h.queryVisitorCount,
  queryVisitorSparkline: h.queryVisitorSparkline,
  queryVisitorCountsByFunnel: h.queryVisitorCountsByFunnel,
  queryAttributedOrders: h.queryAttributedOrders,
  queryLatestTrafficAt: h.queryLatestTrafficAt,
}));
vi.mock('@/lib/dashboard/system-activity', () => ({
  loadSystemActivity: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/composition/make-acquisition-ads', () => ({
  makeAcquisitionAds: vi.fn().mockRejectedValue(new Error('no ads')),
}));
vi.mock('@/composition/make-ads-deps', () => ({
  createAdsDepsForRequest: vi.fn().mockRejectedValue(new Error('no ads')),
}));
vi.mock('@/lib/config/keys', () => ({
  getLastConversionAnalysisResult: h.getLastMock,
}));
vi.mock('@/lib/config/payment', () => ({
  listPaymentProviders: vi.fn().mockResolvedValue([]),
  getPaymentProviderEntryWithCredentials: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/config/email', () => ({
  getEmailKvConfigWithCredentials: vi.fn().mockResolvedValue(null),
}));

import { loadOverviewData } from '@/lib/dashboard/overview-data';

const NOW = new Date('2026-05-03T16:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  h.getLastMock.mockResolvedValue(undefined);
  // KPI orders query (where.createdAt) vs recall-revenue query (where.saleRef).
  h.orderFindMany.mockImplementation((args: { where?: { saleRef?: unknown } }) => {
    if (args?.where?.saleRef) return Promise.resolve([{ saleRef: 'sale_1', capturedTotal: 5000 }]);
    return Promise.resolve([
      { createdAt: NOW, status: 'PAID', capturedTotal: 3000 },
      { createdAt: NOW, status: 'PAID', capturedTotal: 2000 },
      { createdAt: NOW, status: 'PENDING', capturedTotal: 0 },
      { createdAt: NOW, status: 'PAID', capturedTotal: 1000 },
    ]);
  });
  h.funnelFindMany.mockResolvedValue([
    { id: 'f1', name: 'Alpha', updatedAt: new Date(NOW.getTime() - 3 * 24 * 3600e3) },
    { id: 'f2', name: 'Beta', updatedAt: new Date(NOW.getTime() - 3 * 24 * 3600e3) },
  ]);
  h.recallAttemptFindMany.mockResolvedValue([{ checkoutRef: 'sale_1', updatedAt: NOW }]);
  // Site-wide 24h visits = 10, prev = 5.
  h.queryVisitorCount.mockImplementation((_f: unknown, since: Date) =>
    Promise.resolve(since.getTime() >= NOW.getTime() - 24 * 3600e3 ? 10 : 5),
  );
  h.queryVisitorSparkline.mockResolvedValue(new Array<number>(24).fill(0));
  h.queryVisitorCountsByFunnel.mockResolvedValue([
    { funnelId: 'f1', visitors: 7 },
    { funnelId: 'f2', visitors: 3 },
  ]);
  h.queryAttributedOrders.mockResolvedValue([
    { orderId: 'o1', funnelId: 'f1', visitorId: 'v1', capturedTotal: 3000, status: 'PAID', createdAt: NOW },
    { orderId: 'o2', funnelId: 'f1', visitorId: 'v2', capturedTotal: 2000, status: 'PAID', createdAt: NOW },
    { orderId: 'o3', funnelId: 'f2', visitorId: 'v3', capturedTotal: 1000, status: 'PAID', createdAt: NOW },
  ]);
  h.queryLatestTrafficAt.mockResolvedValue(new Date(NOW.getTime() - 5 * 60e3));
});

describe('loadOverviewData — conversion KPI', () => {
  it('computes conversion from real orders / site visits (not hardcoded 0)', async () => {
    const data = await loadOverviewData(NOW);
    // 4 orders (any status) in 24h / 10 visits = 40.00%
    expect(data.metrics.orders.value).toBe('4');
    expect(data.metrics.conversion.value).toBe('40.00%');
    expect(data.metrics.conversion.value).not.toBe('0.00%');
  });

  it('returns 0.00% when there are no visits (no divide-by-zero)', async () => {
    h.queryVisitorCount.mockResolvedValue(0);
    const data = await loadOverviewData(NOW);
    expect(data.metrics.conversion.value).toBe('0.00%');
  });
});

describe('loadOverviewData — per-funnel rows', () => {
  it('fills each funnel row with real visits/orders/conv', async () => {
    const data = await loadOverviewData(NOW);
    const alpha = data.funnels.rows.find((r) => r.id === 'f1')!;
    const beta = data.funnels.rows.find((r) => r.id === 'f2')!;
    expect(alpha).toMatchObject({ visits24h: 7, orders24h: 2, conv: '28.57%' });
    expect(beta).toMatchObject({ visits24h: 3, orders24h: 1, conv: '33.33%' });
  });

  it('shows 0 visits / 0 orders for a funnel with no traffic', async () => {
    h.queryVisitorCountsByFunnel.mockResolvedValue([]);
    h.queryAttributedOrders.mockResolvedValue([]);
    const data = await loadOverviewData(NOW);
    expect(data.funnels.rows.every((r) => r.visits24h === 0 && r.orders24h === 0 && r.conv === '0.00%')).toBe(true);
  });
});

describe('loadOverviewData — recall recovered', () => {
  it('counts recovered attempts and sums linked order revenue', async () => {
    const data = await loadOverviewData(NOW);
    expect(data.recallRecovered.count).toBe(1);
    expect(data.recallRecovered.revenue).toBe('$50.00');
  });

  it('returns the empty state when no attempts were recovered', async () => {
    h.recallAttemptFindMany.mockResolvedValue([]);
    const data = await loadOverviewData(NOW);
    expect(data.recallRecovered.count).toBe(0);
    expect(data.recallRecovered.revenue).toBe('$0.00');
  });
});

describe('loadOverviewData — last activity', () => {
  it('tracks the most recent traffic, not the stale funnel edit time', async () => {
    const data = await loadOverviewData(NOW);
    // latest traffic 5m ago beats funnel.updatedAt 3d ago
    expect(data.funnels.lastSyncSec).toBe(5 * 60);
  });
});

describe('loadOverviewData — lastAnalysis', () => {
  it('returns lastAnalysis: null when AppConfig key is missing', async () => {
    h.getLastMock.mockResolvedValue(undefined);
    const data = await loadOverviewData(NOW);
    expect(data.lastAnalysis).toBeNull();
  });

  it('returns lastAnalysis: null when reading the key throws', async () => {
    h.getLastMock.mockRejectedValue(new Error('kv down'));
    const data = await loadOverviewData(NOW);
    expect(data.lastAnalysis).toBeNull();
  });

  it('returns the parsed lastAnalysis object when set', async () => {
    const stored = {
      runAt: '2026-05-03T16:00:00.000Z',
      timeRange: '2026-05-03 14:00 ~ 2026-05-03 16:00',
      sessionsAnalyzed: 17,
      summary: 'summary text',
      analysis: 'llm text',
      hasLlmInsights: true,
    };
    h.getLastMock.mockResolvedValue(stored);
    const data = await loadOverviewData(NOW);
    expect(data.lastAnalysis).toEqual(stored);
  });
});
