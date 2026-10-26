import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./ads-reconciliation-queries', () => ({
  queryPlatformMetrics: vi.fn(),
  queryOnsiteClicksByFunnel: vi.fn(),
  queryOnsiteOrdersByFunnel: vi.fn(),
  queryFailedPostbackCounts: vi.fn(),
  queryUnassignedCreatives: vi.fn(),
  queryCreativeDetailsByFunnel: vi.fn(),
  queryOnsiteCheckoutsByFunnel: vi.fn(),
}));

// loadAdReconciliation also reaches getBasePrisma() directly (adAccountConnection.findMany,
// funnel.findMany) rather than going through ads-reconciliation-queries.ts, so it needs its own
// mock -- same technique as ads-reconciliation-queries.test.ts uses for its raw-SQL layer.
vi.mock('@/lib/db', () => ({
  getBasePrisma: () => ({
    adAccountConnection: { findMany: vi.fn().mockResolvedValue([]) },
    funnel: { findMany: vi.fn().mockResolvedValue([]) },
  }),
}));
vi.mock('@/lib/tenant/context', () => ({ getCurrentTenantId: () => 'tenant-1' }));
// vi.fn (not a plain async arrow) so individual tests can override the resolved timezone with
// mockResolvedValueOnce -- needed by the site-timezone date-range regression tests below.
vi.mock('@/lib/config/keys', () => ({ getSiteTimezone: vi.fn(async () => 'UTC') }));

import { getSiteTimezone } from '@/lib/config/keys';
import {
  queryPlatformMetrics,
  queryOnsiteClicksByFunnel,
  queryOnsiteOrdersByFunnel,
  queryFailedPostbackCounts,
  queryUnassignedCreatives,
  queryCreativeDetailsByFunnel,
  queryOnsiteCheckoutsByFunnel,
  type UnassignedCreativeRow,
} from './ads-reconciliation-queries';
import { assembleReconciliation, loadAdReconciliation } from './ads-reconciliation-data';

const ctx = {
  siteTimezone: 'UTC',
  funnelNames: new Map([['funnel-a', 'Glow Funnel']]),
  connections: new Map([
    ['conn-1', { label: 'act_1', timezone: 'UTC', expired: false }],
    ['conn-2', { label: 'adv_2', timezone: 'Asia/Shanghai', expired: false }],
  ]),
};

describe('assembleReconciliation', () => {
  it('groups by currency and never sums across currencies', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 1000, impressions: 10, clicks: 100, linkClicks: 80, conversions: 4, initiateCheckout: null, conversionValueMinor: 9000 },
          { funnelId: 'funnel-a', platform: 'TIKTOK', connectionId: 'conn-2', currency: 'EUR', spendMinor: 2000, impressions: 20, clicks: 200, linkClicks: null, conversions: 6, initiateCheckout: null, conversionValueMinor: 8000 },
        ],
        onsiteClicks: new Map([['funnel-a', 95]]),
        onsiteOrders: [{ funnelId: 'funnel-a', currency: 'USD', orders: 4, revenueMinor: 9000 }],
        failedPostbacks: new Map(),
        unassigned: [],
      },
      ctx,
    );

    expect(vm.currencyGroups.map((g) => g.currency).sort()).toEqual(['EUR', 'USD']);
    const usd = vm.currencyGroups.find((g) => g.currency === 'USD')!;
    expect(usd.totals.spendMinor).toBe(1000);
  });

  it('treats a platform with no separate link-click metric as reporting link clicks under clicks', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'TIKTOK', connectionId: 'conn-2', currency: 'EUR', spendMinor: 1, impressions: 1, clicks: 1, linkClicks: null, conversions: 0, initiateCheckout: null, conversionValueMinor: 0 },
        ],
        onsiteClicks: new Map(),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [],
      },
      ctx,
    );
    expect(vm.currencyGroups[0].rows[0].linkClicks).toBe(1);
  });

  it('reports unattributed spend separately instead of folding it into a funnel', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: null, platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 5000, impressions: 1, clicks: 1, linkClicks: 1, conversions: 0, initiateCheckout: null, conversionValueMinor: 0 },
        ],
        onsiteClicks: new Map(),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [{ creativeId: 'cr-1', platform: 'META', name: 'Ad', destinationUrl: 'https://x/y', normalizedPath: '/y', matchState: 'UNMATCHED', spendMinor: 5000, currency: 'USD', candidateFunnelIds: [] }],
      },
      ctx,
    );
    const usd = vm.currencyGroups.find((g) => g.currency === 'USD')!;
    expect(usd.rows).toHaveLength(0);
    expect(usd.unattributedSpendMinor).toBe(5000);
    expect(vm.unassigned).toHaveLength(1);
  });

  it('attaches a timezone-mismatch reason when the account zone differs from the site zone', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'TIKTOK', connectionId: 'conn-2', currency: 'USD', spendMinor: 1, impressions: 1, clicks: 100, linkClicks: null, conversions: 10, initiateCheckout: null, conversionValueMinor: 0 },
        ],
        onsiteClicks: new Map([['funnel-a', 100]]),
        onsiteOrders: [{ funnelId: 'funnel-a', currency: 'USD', orders: 10, revenueMinor: 0 }],
        failedPostbacks: new Map(),
        unassigned: [],
      },
      ctx,
    );
    expect(vm.currencyGroups[0].rows[0].reasons.map((r) => r.code)).toContain('TIMEZONE_MISMATCH');
  });

  it('surfaces failed postbacks on the affected funnel row', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 1, impressions: 1, clicks: 100, linkClicks: 80, conversions: 20, initiateCheckout: null, conversionValueMinor: 0 },
        ],
        onsiteClicks: new Map([['funnel-a', 100]]),
        onsiteOrders: [{ funnelId: 'funnel-a', currency: 'USD', orders: 5, revenueMinor: 0 }],
        failedPostbacks: new Map([['funnel-a', 9]]),
        unassigned: [],
      },
      ctx,
    );
    const row = vm.currencyGroups[0].rows[0];
    expect(row.conversionsDiff.severity).toBe('ALERT');
    expect(row.reasons.find((r) => r.code === 'FAILED_POSTBACKS')?.detail).toContain('9');
  });

  it('sorts unassigned creatives by spend descending so the biggest leak is first', () => {
    const vm = assembleReconciliation(
      {
        platform: [],
        onsiteClicks: new Map(),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [
          { creativeId: 'a', platform: 'META', name: 'small', destinationUrl: null, normalizedPath: null, matchState: 'UNMATCHED', spendMinor: 10, currency: 'USD', candidateFunnelIds: [] },
          { creativeId: 'b', platform: 'META', name: 'big', destinationUrl: null, normalizedPath: null, matchState: 'UNMATCHED', spendMinor: 900, currency: 'USD', candidateFunnelIds: [] },
        ],
      },
      ctx,
    );
    expect(vm.unassigned.map((u) => u.creativeId)).toEqual(['b', 'a']);
  });

  // Fix round 1 / IMPORTANT-1: PlatformMetricRow.ambiguousCreatives was structurally always 0 on
  // any row with a real funnelId (AMBIGUOUS/UNMATCHED creatives always carry funnelId = null), so
  // UNASSIGNED_CREATIVES could never appear. The count now comes from queryUnassignedCreatives's
  // candidateFunnelIds instead, resolved per funnel.
  it('surfaces UNASSIGNED_CREATIVES on a funnel row when an unassigned creative candidates for it', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 100, impressions: 1, clicks: 1, linkClicks: 1, conversions: 1, initiateCheckout: null, conversionValueMinor: 0 },
        ],
        onsiteClicks: new Map(),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [
          { creativeId: 'cr-amb', platform: 'META', name: 'Ambiguous ad', destinationUrl: 'https://x/shared', normalizedPath: '/shared', matchState: 'AMBIGUOUS', spendMinor: 300, currency: 'USD', candidateFunnelIds: ['funnel-a', 'funnel-b'] },
        ],
      },
      ctx,
    );
    const row = vm.currencyGroups[0].rows.find((r) => r.funnelId === 'funnel-a')!;
    expect(row.reasons.map((r) => r.code)).toContain('UNASSIGNED_CREATIVES');
    expect(row.reasons.find((r) => r.code === 'UNASSIGNED_CREATIVES')?.detail).toContain('1');
  });

  // IMPORTANT-2: unattributedCreatives was fed by ambiguousCreatives, which only counted
  // matchState AMBIGUOUS, while unattributedSpendMinor on the same branch already included
  // UNMATCHED spend. The count now comes straight from queryUnassignedCreatives and counts every
  // unassigned creative in the currency, AMBIGUOUS and UNMATCHED alike.
  it('counts an UNMATCHED creative in the currency group unattributed count, not just AMBIGUOUS ones', () => {
    const vm = assembleReconciliation(
      {
        platform: [],
        onsiteClicks: new Map(),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [
          { creativeId: 'cr-1', platform: 'META', name: 'Ambiguous ad', destinationUrl: null, normalizedPath: null, matchState: 'AMBIGUOUS', spendMinor: 100, currency: 'USD', candidateFunnelIds: ['funnel-a'] },
          { creativeId: 'cr-2', platform: 'META', name: 'Unmatched ad', destinationUrl: null, normalizedPath: null, matchState: 'UNMATCHED', spendMinor: 50, currency: 'USD', candidateFunnelIds: [] },
        ],
      },
      ctx,
    );
    const usd = vm.currencyGroups.find((g) => g.currency === 'USD')!;
    expect(usd.unattributedCreatives).toBe(2);
  });

  // IMPORTANT-3: revenue must never be diffed across currencies. A funnel whose onsite orders are
  // recorded in a different currency than its ad account's reporting currency must show the
  // onsite figure as unavailable, not compare (and definitely not silently sum) money across
  // currencies.
  it('does not diff revenue across currencies when the funnel onsite orders are in a different currency', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 100, impressions: 1, clicks: 1, linkClicks: 1, conversions: 5, initiateCheckout: null, conversionValueMinor: 10000 },
        ],
        onsiteClicks: new Map(),
        // Same funnel's orders are all recorded in EUR, not the ad account's USD.
        onsiteOrders: [{ funnelId: 'funnel-a', currency: 'EUR', orders: 5, revenueMinor: 9000 }],
        failedPostbacks: new Map(),
        unassigned: [],
      },
      ctx,
    );
    const row = vm.currencyGroups[0].rows[0];
    expect(row.onsiteRevenueMinor).toBeNull();
    expect(row.revenueDiff).toBeNull();
    expect(row.reasons.map((r) => r.code)).toContain('REVENUE_CURRENCY_UNAVAILABLE');
    // Order count is currency-agnostic (a conversion is a conversion) and is still compared.
    expect(row.onsiteOrders).toBe(5);
    expect(row.conversionsDiff).not.toBeNull();
  });

  it('compares revenue normally (as a real zero) when a funnel simply has no onsite orders in any currency', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 100, impressions: 1, clicks: 1, linkClicks: 1, conversions: 0, initiateCheckout: null, conversionValueMinor: 0 },
        ],
        onsiteClicks: new Map(),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [],
      },
      ctx,
    );
    const row = vm.currencyGroups[0].rows[0];
    expect(row.onsiteRevenueMinor).toBe(0);
    expect(row.revenueDiff).not.toBeNull();
    expect(row.reasons.map((r) => r.code)).not.toContain('REVENUE_CURRENCY_UNAVAILABLE');
  });

  // Task 11: row.creatives used to be a permanent [] placeholder (see task-10-report.md). It is
  // now sourced from queryCreativeDetailsByFunnel, keyed by (funnelId, currency, connectionId) so
  // two rows sharing a funnel+currency but differing connection each only see their own creatives.
  it('populates row.creatives from creativeDetails, keyed by funnel + currency + connectionId', () => {
    const detail = {
      creativeId: 'cr-1',
      platform: 'META',
      name: 'Ad one',
      campaignName: 'Spring sale',
      adsetName: null,
      destinationUrl: 'https://x/y',
      spendMinor: 100,
      impressions: 10,
      clicks: 5,
      linkClicks: null,
      conversions: 1,
      initiateCheckout: null,
    };
    const otherConnectionDetail = { ...detail, creativeId: 'cr-2' };
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 100, impressions: 10, clicks: 5, linkClicks: null, conversions: 1, initiateCheckout: null, conversionValueMinor: 0 },
        ],
        onsiteClicks: new Map(),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [],
        creativeDetails: new Map([
          ['funnel-a::USD::conn-1', [detail]],
          ['funnel-a::USD::conn-2', [otherConnectionDetail]],
        ]),
      },
      ctx,
    );
    const row = vm.currencyGroups[0].rows[0];
    expect(row.creatives).toEqual([detail]);
  });

  // IMPORTANT (fix round 1): account discovery creates one connection per ad account, so a funnel
  // with two connections on the SAME platform is the normal shape, not a rare edge case.
  // queryPlatformMetrics correctly produces two separate rows (grouped by connectionId); each
  // row's creatives must show only that connection's own creatives, and the expanded creatives'
  // spend must sum to that row's own headline spend -- not the combined spend of both connections.
  it('keeps two connections on the same platform from leaking creatives into each other’s row', () => {
    const connADetail = {
      creativeId: 'cr-a',
      platform: 'META',
      name: 'Connection A ad',
      campaignName: 'A campaign',
      adsetName: null,
      destinationUrl: 'https://x/a',
      spendMinor: 400,
      impressions: 40,
      clicks: 4,
      linkClicks: null,
      conversions: 1,
      initiateCheckout: null,
    };
    const connBDetail = {
      creativeId: 'cr-b',
      platform: 'META',
      name: 'Connection B ad',
      campaignName: 'B campaign',
      adsetName: null,
      destinationUrl: 'https://x/b',
      spendMinor: 600,
      impressions: 60,
      clicks: 6,
      linkClicks: null,
      conversions: 2,
      initiateCheckout: null,
    };
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 400, impressions: 40, clicks: 4, linkClicks: null, conversions: 1, initiateCheckout: null, conversionValueMinor: 0 },
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-2', currency: 'USD', spendMinor: 600, impressions: 60, clicks: 6, linkClicks: null, conversions: 2, initiateCheckout: null, conversionValueMinor: 0 },
        ],
        onsiteClicks: new Map(),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [],
        creativeDetails: new Map([
          ['funnel-a::USD::conn-1', [connADetail]],
          ['funnel-a::USD::conn-2', [connBDetail]],
        ]),
      },
      ctx,
    );

    const rowA = vm.currencyGroups[0].rows.find((r) => r.spendMinor === 400)!;
    const rowB = vm.currencyGroups[0].rows.find((r) => r.spendMinor === 600)!;

    expect(rowA.creatives).toEqual([connADetail]);
    expect(rowB.creatives).toEqual([connBDetail]);
    expect(rowA.creatives.some((c) => c.creativeId === 'cr-b')).toBe(false);
    expect(rowB.creatives.some((c) => c.creativeId === 'cr-a')).toBe(false);

    // The property that actually matters to a reader: what you see when you expand a row must add
    // up to that row's own headline spend, not the combined spend of both connections.
    const sumSpend = (creatives: Array<{ spendMinor: number }>) => creatives.reduce((sum, c) => sum + c.spendMinor, 0);
    expect(sumSpend(rowA.creatives)).toBe(rowA.spendMinor);
    expect(sumSpend(rowB.creatives)).toBe(rowB.spendMinor);
  });

  // Defect: onsiteClicks/onsiteOrders/onsiteRevenueMinor are computed per FUNNEL but were added
  // into group.totals once per PlatformMetricRow (i.e. once per connection). A funnel with two
  // connections on the same platform -- the normal shape per the test above -- must still
  // contribute its onsite figures to the currency group's totals exactly once, not once per row.
  it('does not double-count a funnel’s onsite figures in group totals when it has two connections on one platform', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 400, impressions: 40, clicks: 4, linkClicks: null, conversions: 1, initiateCheckout: null, conversionValueMinor: 5000 },
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-2', currency: 'USD', spendMinor: 600, impressions: 60, clicks: 6, linkClicks: null, conversions: 2, initiateCheckout: null, conversionValueMinor: 5000 },
        ],
        onsiteClicks: new Map([['funnel-a', 100]]),
        onsiteOrders: [{ funnelId: 'funnel-a', currency: 'USD', orders: 3, revenueMinor: 9000 }],
        failedPostbacks: new Map(),
        unassigned: [],
      },
      ctx,
    );

    const usd = vm.currencyGroups.find((g) => g.currency === 'USD')!;
    expect(usd.totals.onsiteClicks).toBe(100);
    expect(usd.totals.onsiteOrders).toBe(3);
    expect(usd.totals.onsiteRevenueMinor).toBe(9000);
    // Spend/impressions/link clicks are genuinely per row and must still sum across both connections.
    expect(usd.totals.spendMinor).toBe(1000);
    expect(usd.totals.impressions).toBe(100);
    expect(usd.totals.linkClicks).toBe(10);
  });

  it('leaves row.creatives empty when creativeDetails is not supplied at all', () => {
    const vm = assembleReconciliation(
      {
        platform: [
          { funnelId: 'funnel-a', platform: 'META', connectionId: 'conn-1', currency: 'USD', spendMinor: 100, impressions: 10, clicks: 5, linkClicks: null, conversions: 1, initiateCheckout: null, conversionValueMinor: 0 },
        ],
        onsiteClicks: new Map(),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [],
      },
      ctx,
    );
    expect(vm.currencyGroups[0].rows[0].creatives).toEqual([]);
  });
});

// Fix round 1: loadAdReconciliation filtered platformRows by funnelId but passed the FULL
// tenant-wide unassignedRows straight through to assembleReconciliation regardless of
// input.funnelId. assembleReconciliation's own loop over raw.unassigned is unconditional (it has
// no concept of "the requested funnel"), so every one of these assertions failed against the
// pre-fix code: another funnel's unassigned creative leaked into `unassigned`, inflated
// unattributedCreatives on a real currency group, and could synthesize a currency group for a
// currency this funnel has no data in at all.
describe('loadAdReconciliation funnel scoping of unassigned creatives', () => {
  const unassignedForFunnelB: UnassignedCreativeRow = {
    creativeId: 'cr-b',
    platform: 'META',
    name: 'Ad for funnel-b',
    destinationUrl: 'https://x/b',
    normalizedPath: '/b',
    matchState: 'UNMATCHED',
    spendMinor: 700,
    currency: 'USD',
    candidateFunnelIds: ['funnel-b'],
  };

  beforeEach(() => {
    vi.mocked(queryPlatformMetrics).mockResolvedValue([
      {
        funnelId: 'funnel-a',
        platform: 'META',
        connectionId: 'conn-1',
        currency: 'USD',
        spendMinor: 100,
        impressions: 1,
        clicks: 1,
        linkClicks: 1,
        conversions: 1,
        initiateCheckout: null,
        conversionValueMinor: 0,
      },
    ]);
    vi.mocked(queryOnsiteClicksByFunnel).mockResolvedValue([]);
    vi.mocked(queryOnsiteOrdersByFunnel).mockResolvedValue([]);
    vi.mocked(queryFailedPostbackCounts).mockResolvedValue([]);
    vi.mocked(queryCreativeDetailsByFunnel).mockResolvedValue([]);
    vi.mocked(queryOnsiteCheckoutsByFunnel).mockResolvedValue([]);
  });

  it('excludes another funnel candidate-only creative from the returned unassigned list', async () => {
    vi.mocked(queryUnassignedCreatives).mockResolvedValue([unassignedForFunnelB]);
    const vm = await loadAdReconciliation({
      start: new Date('2026-01-01'),
      end: new Date('2026-01-08'),
      funnelId: 'funnel-a',
    });
    expect(vm.unassigned).toHaveLength(0);
  });

  it('does not inflate unattributedCreatives on a currency group that has real rows for this funnel', async () => {
    // Same currency (USD) as funnel-a's own row, so it would land in the SAME group if leaked.
    vi.mocked(queryUnassignedCreatives).mockResolvedValue([unassignedForFunnelB]);
    const vm = await loadAdReconciliation({
      start: new Date('2026-01-01'),
      end: new Date('2026-01-08'),
      funnelId: 'funnel-a',
    });
    const usd = vm.currencyGroups.find((g) => g.currency === 'USD')!;
    expect(usd.unattributedCreatives).toBe(0);
  });

  it('does not synthesize a currency group for a currency only another funnel candidate uses', async () => {
    vi.mocked(queryUnassignedCreatives).mockResolvedValue([{ ...unassignedForFunnelB, currency: 'EUR' }]);
    const vm = await loadAdReconciliation({
      start: new Date('2026-01-01'),
      end: new Date('2026-01-08'),
      funnelId: 'funnel-a',
    });
    expect(vm.currencyGroups.some((g) => g.currency === 'EUR')).toBe(false);
  });

  it('keeps a creative that genuinely candidates for the requested funnel, even with zero rows in its currency', async () => {
    const candidateForA: UnassignedCreativeRow = {
      ...unassignedForFunnelB,
      creativeId: 'cr-a',
      candidateFunnelIds: ['funnel-a'],
      currency: 'EUR',
    };
    vi.mocked(queryUnassignedCreatives).mockResolvedValue([candidateForA]);
    const vm = await loadAdReconciliation({
      start: new Date('2026-01-01'),
      end: new Date('2026-01-08'),
      funnelId: 'funnel-a',
    });
    expect(vm.unassigned).toEqual([candidateForA]);
    const eur = vm.currencyGroups.find((g) => g.currency === 'EUR');
    expect(eur).toBeDefined();
    expect(eur?.rows).toHaveLength(0);
    expect(eur?.unattributedCreatives).toBe(1);
  });
});

// CRITICAL fix: loadAdReconciliation used to derive the SQL date range with
// `d.toISOString().slice(0, 10)`, i.e. the UTC calendar day of the instant -- not the calendar day
// in the site's own timezone. On any site timezone ahead of UTC (e.g. Asia/Shanghai, UTC+8) this
// shifted the query window a day earlier than what the admin saw as "today"; on any timezone behind
// UTC it could shift it a day later. Fixed by deriving the range with isoDateInTz(date,
// siteTimezone), and by preferring explicit startDateStr/endDateStr when a caller already has them.
describe('loadAdReconciliation derives the SQL date range in the site timezone', () => {
  beforeEach(() => {
    vi.mocked(queryPlatformMetrics).mockResolvedValue([]);
    vi.mocked(queryOnsiteClicksByFunnel).mockResolvedValue([]);
    vi.mocked(queryOnsiteOrdersByFunnel).mockResolvedValue([]);
    vi.mocked(queryFailedPostbackCounts).mockResolvedValue([]);
    vi.mocked(queryUnassignedCreatives).mockResolvedValue([]);
    vi.mocked(queryCreativeDetailsByFunnel).mockResolvedValue([]);
  });

  it('uses the Asia/Shanghai calendar day, not the UTC calendar day, for a midnight-local instant', async () => {
    vi.mocked(getSiteTimezone).mockResolvedValueOnce('Asia/Shanghai');
    // 2026-09-05 00:00:00 in Asia/Shanghai (UTC+8) is 2026-09-04T16:00:00Z -- the UTC-date bug
    // would read this instant as belonging to 2026-09-04.
    const start = new Date('2026-09-04T16:00:00.000Z');
    // 2026-09-05 23:59:59.999 in Asia/Shanghai is 2026-09-05T15:59:59.999Z.
    const end = new Date('2026-09-05T15:59:59.999Z');

    await loadAdReconciliation({ start, end });

    expect(queryPlatformMetrics).toHaveBeenCalledWith('2026-09-05', '2026-09-05');
    expect(queryOnsiteClicksByFunnel).toHaveBeenCalledWith('2026-09-05', '2026-09-05', 'Asia/Shanghai');
    expect(queryOnsiteOrdersByFunnel).toHaveBeenCalledWith('2026-09-05', '2026-09-05', 'Asia/Shanghai');
    expect(queryUnassignedCreatives).toHaveBeenCalledWith('2026-09-05', '2026-09-05');
  });

  it('uses the America/Los_Angeles calendar day for the same UTC instant, proving the range tracks the site timezone', async () => {
    vi.mocked(getSiteTimezone).mockResolvedValueOnce('America/Los_Angeles');
    // The same 2026-09-05T00:00Z..2026-09-05T08:00Z UTC window is still 2026-09-04 in
    // America/Los_Angeles (UTC-7 in September, DST) for its earliest instant.
    const start = new Date('2026-09-05T00:00:00.000Z');
    const end = new Date('2026-09-05T08:00:00.000Z');

    await loadAdReconciliation({ start, end });

    expect(queryPlatformMetrics).toHaveBeenCalledWith('2026-09-04', '2026-09-05');
  });

  it('prefers explicit startDateStr/endDateStr over deriving from the Date instants at all', async () => {
    vi.mocked(getSiteTimezone).mockResolvedValueOnce('Asia/Shanghai');
    // Deliberately mismatched instants: if the fix ever regresses to ignoring these strings, this
    // assertion fails because the derived dates ('2026-01-01') would not match.
    await loadAdReconciliation({
      start: new Date('2026-01-01T00:00:00.000Z'),
      end: new Date('2026-01-01T00:00:00.000Z'),
      startDateStr: '2026-09-05',
      endDateStr: '2026-09-06',
    });

    expect(queryPlatformMetrics).toHaveBeenCalledWith('2026-09-05', '2026-09-06');
  });
});

describe('assembleReconciliation timezone alignment', () => {
  const tzCtx = {
    siteTimezone: 'Asia/Shanghai',
    funnelNames: new Map([['funnel-a', 'Glow Funnel']]),
    connections: new Map([
      ['conn-1', { label: 'act_1', timezone: 'America/Los_Angeles', expired: false }],
      ['conn-2', { label: 'act_2', timezone: 'Asia/Shanghai', expired: false }],
    ]),
  };

  const platformRow = (connectionId: string) => ({
    funnelId: 'funnel-a',
    platform: 'META',
    connectionId,
    currency: 'USD',
    spendMinor: 1000,
    impressions: 100,
    clicks: 60,
    linkClicks: 60,
    conversions: 5,
    initiateCheckout: 20,
    conversionValueMinor: 9000,
  });

  it('compares an account against onsite figures re-bucketed into that account own reporting zone', () => {
    const vm = assembleReconciliation(
      {
        platform: [platformRow('conn-1')],
        onsiteClicks: new Map([['funnel-a', 500]]),
        onsiteCheckouts: new Map([['funnel-a', 500]]),
        onsiteOrders: [{ funnelId: 'funnel-a', currency: 'USD', orders: 500, revenueMinor: 500000 }],
        onsiteByTimezone: new Map([
          [
            'America/Los_Angeles',
            {
              clicks: new Map([['funnel-a', 58]]),
              checkouts: new Map([['funnel-a', 19]]),
              orders: [{ funnelId: 'funnel-a', currency: 'USD', orders: 5, revenueMinor: 9000 }],
            },
          ],
        ]),
        failedPostbacks: new Map(),
        unassigned: [],
      },
      tzCtx,
    );

    const row = vm.currencyGroups[0].rows[0];
    // The site-timezone figures (500 everywhere) must not leak in: this row is measured on the ad
    // account's calendar, which is the only way its two sides describe the same interval.
    expect(row.onsiteClicks).toBe(58);
    expect(row.onsiteCheckouts).toBe(19);
    expect(row.onsiteOrders).toBe(5);
    expect(row.onsiteRevenueMinor).toBe(9000);
    expect(row.clicksDiff.severity).toBe('OK');
  });

  it('leaves an account already reporting in the site zone on the site-timezone figures', () => {
    const vm = assembleReconciliation(
      {
        platform: [platformRow('conn-2')],
        onsiteClicks: new Map([['funnel-a', 58]]),
        onsiteCheckouts: new Map([['funnel-a', 19]]),
        onsiteOrders: [{ funnelId: 'funnel-a', currency: 'USD', orders: 5, revenueMinor: 9000 }],
        onsiteByTimezone: new Map([
          [
            'America/Los_Angeles',
            { clicks: new Map([['funnel-a', 999]]), checkouts: new Map(), orders: [] },
          ],
        ]),
        failedPostbacks: new Map(),
        unassigned: [],
      },
      tzCtx,
    );
    expect(vm.currencyGroups[0].rows[0].onsiteClicks).toBe(58);
  });

  it('falls back to the site-timezone figures when no bucketing exists for the account zone', () => {
    const vm = assembleReconciliation(
      {
        platform: [platformRow('conn-1')],
        onsiteClicks: new Map([['funnel-a', 77]]),
        onsiteOrders: [],
        failedPostbacks: new Map(),
        unassigned: [],
      },
      tzCtx,
    );
    expect(vm.currencyGroups[0].rows[0].onsiteClicks).toBe(77);
  });
});
