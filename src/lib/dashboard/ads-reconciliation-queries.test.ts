import { describe, it, expect, vi, beforeEach } from 'vitest';

// vitest.config.ts points DATABASE_URL at a dummy local Postgres that is never actually up, so a
// real query would just hang/fail to connect -- these tests mock getBasePrisma and capture the
// exact SQL text, the same technique coupon.repository.test.ts uses for its raw-SQL assertions.
const captured: { sql?: string; params?: unknown[] } = {};

let nextRows: unknown[] = [{ funnelId: 'funnel-a', count: 3 }];

vi.mock('@/lib/db', () => ({
  getBasePrisma: () => ({
    $queryRawUnsafe: async (sql: string, ...params: unknown[]) => {
      captured.sql = sql;
      captured.params = params;
      return nextRows;
    },
  }),
}));

vi.mock('@/lib/tenant/context', () => ({ getCurrentTenantId: () => 'tenant-1' }));

import { queryFailedPostbackCounts, queryCreativeDetailsByFunnel } from './ads-reconciliation-queries';

describe('queryFailedPostbackCounts', () => {
  beforeEach(() => {
    captured.sql = undefined;
    captured.params = undefined;
    nextRows = [{ funnelId: 'funnel-a', count: 3 }];
  });

  // Fix round 1 / IMPORTANT-4: a failed postback used to attribute to a funnel only through
  // ad_creatives (COALESCE(manualFunnelId, autoFunnelId)), so a freshly wired connection -- bound
  // to a funnel via funnel_ad_connections, but with zero ad_creatives rows resolved yet -- silently
  // reported zero failures for exactly the highest-risk window: a brand new conversion setup.
  // The join must reach a funnel through Postback -> AdConversionDestination -> funnel_ad_connections
  // alone, with no reference to ad_creatives anywhere in the query.
  it('attributes through funnel_ad_connections directly, with no dependency on a resolved ad_creatives match', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');
    const rows = await queryFailedPostbackCounts(start, end);

    expect(rows).toEqual([{ funnelId: 'funnel-a', count: 3 }]);
    expect(captured.sql).not.toContain('ad_creatives');
    expect(captured.sql).toContain('"Postback"');
    expect(captured.sql).toContain('"AdConversionDestination"');
    expect(captured.sql).toContain('funnel_ad_connections');
    expect(captured.params).toEqual(['tenant-1', start, end]);
  });
});

describe('queryCreativeDetailsByFunnel', () => {
  beforeEach(() => {
    captured.sql = undefined;
    captured.params = undefined;
    nextRows = [
      {
        creativeId: 'cr-1',
        platform: 'META',
        name: 'Ad one',
        campaignName: 'Spring sale',
        adsetName: 'Spring set',
        destinationUrl: 'https://x/y',
        spendMinor: 1000,
        impressions: 500,
        clicks: 40,
        linkClicks: null,
        conversions: 2.5,
        initiateCheckout: 7,
      },
    ];
  });

  it('scopes the query to one funnel, one connection, and one currency, using the same effective-funnel resolution as queryPlatformMetrics', async () => {
    const rows = await queryCreativeDetailsByFunnel('funnel-a', 'conn-1', 'USD', '2026-01-01', '2026-01-31');

    expect(rows).toEqual([
      {
        creativeId: 'cr-1',
        platform: 'META',
        name: 'Ad one',
        campaignName: 'Spring sale',
        adsetName: 'Spring set',
        destinationUrl: 'https://x/y',
        spendMinor: 1000,
        impressions: 500,
        clicks: 40,
        linkClicks: null,
        conversions: 2.5,
        initiateCheckout: 7,
      },
    ]);
    expect(captured.sql).toContain('COALESCE(c."manualFunnelId", c."autoFunnelId") = $2');
    expect(captured.sql).toContain('c."connectionId" = $3');
    expect(captured.sql).toContain('m."currency" = $4');
    expect(captured.params).toEqual(['tenant-1', 'funnel-a', 'conn-1', 'USD', '2026-01-01', '2026-01-31']);
  });

  it('renders a missing linkClicks as null, never as zero', async () => {
    const rows = await queryCreativeDetailsByFunnel('funnel-a', 'conn-1', 'USD', '2026-01-01', '2026-01-31');
    expect(rows[0].linkClicks).toBeNull();
  });
});
