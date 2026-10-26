import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { getSiteTimezone } from '@/lib/config/keys';
import { isoDateInTz } from '@/lib/dashboard/analytics-helpers';
import { timezoneOffsetMinutes } from '@/lib/constants/timezone';
import { computeDiff, detectConflictReasons, type DiffResult, type ConflictReason } from '@/lib/stats/ad-reconciliation';
import { ConnectionHealthEvaluator } from '@/modules/acquisition-ads/domain/services/connection-health-evaluator';
import type { ConnectionStatus } from '@/modules/acquisition-ads/domain/connection/ad-account-connection';
import {
  queryPlatformMetrics,
  queryOnsiteClicksByFunnel,
  queryOnsiteCheckoutsByFunnel,
  queryOnsiteOrdersByFunnel,
  queryFailedPostbackCounts,
  queryUnassignedCreatives,
  queryCreativeDetailsByFunnel,
  type PlatformMetricRow,
  type UnassignedCreativeRow,
  type OnsiteOrderRow,
  type CreativeDetailRow,
} from './ads-reconciliation-queries';

export type UnassignedCreativeVM = UnassignedCreativeRow;

export type CreativeDetailVM = CreativeDetailRow;

export interface ReconciliationRowVM {
  funnelId: string;
  funnelName: string;
  platform: string;
  accountLabel: string;
  accountTimezone: string;
  siteTimezone: string;
  // False when the ad account and this site are on different clocks, so the UI can flag the row
  // without re-deriving the comparison. Compared by UTC offset, never by zone id.
  timezoneAligned: boolean;
  spendMinor: number;
  impressions: number;
  // Link clicks only. Raw `clicks` is still stored, but it counts likes, comments and photo
  // expansions alongside visits, so it can never reconcile against onsite visitors. Platforms with
  // no separate link-click metric (Google Ads, TikTok) report one click figure that already means
  // "click through to the site", so their value lands here unchanged.
  linkClicks: number;
  platformCheckoutInit: number | null;
  onsiteCheckouts: number;
  // Null when the platform reports no checkout-start metric -- there is nothing to compare.
  checkoutInitDiff: DiffResult | null;
  platformConversions: number;
  onsiteOrders: number;
  conversionsDiff: DiffResult;
  platformRevenueMinor: number;
  // Null when this funnel has onsite orders but none in the ad account's own reporting currency
  // for this range -- see revenueDiff below and REVENUE_CURRENCY_UNAVAILABLE.
  onsiteRevenueMinor: number | null;
  // Null instead of a computed diff when onsiteRevenueMinor is null: revenue must never be
  // diffed across currencies, so there is nothing to compare for this row.
  revenueDiff: DiffResult | null;
  clicksDiff: DiffResult;
  onsiteClicks: number;
  reasons: ConflictReason[];
  creatives: CreativeDetailVM[];
}

export interface CurrencyTotals {
  spendMinor: number;
  impressions: number;
  linkClicks: number;
  platformCheckoutInit: number | null;
  platformConversions: number;
  platformRevenueMinor: number;
  onsiteClicks: number;
  onsiteCheckouts: number;
  onsiteOrders: number;
  onsiteRevenueMinor: number;
}

export interface CurrencyGroup {
  currency: string;
  totals: CurrencyTotals;
  unattributedSpendMinor: number;
  unattributedCreatives: number;
  rows: ReconciliationRowVM[];
}

export interface AdReconciliationVM {
  currencyGroups: CurrencyGroup[];
  unassigned: UnassignedCreativeVM[];
  staleConnections: string[];
}

export interface ConnectionInfo {
  label: string;
  timezone: string;
  expired: boolean;
}

export interface ReconciliationContext {
  siteTimezone: string;
  funnelNames: Map<string, string>;
  connections: Map<string, ConnectionInfo>;
}

export interface RawReconciliationInput {
  platform: PlatformMetricRow[];
  onsiteClicks: Map<string, number>;
  // Distinct visitors that reached a checkout step, per funnel. Optional so existing callers and
  // tests that predate the checkout-start column keep working (a missing entry reads as 0).
  onsiteCheckouts?: Map<string, number>;
  // The same onsite figures re-bucketed into an AD ACCOUNT's reporting timezone, keyed by that
  // timezone. Platform reports are cut on the ad account's own calendar and cannot be re-cut, but
  // onsite events are stored as true instants and CAN be, so this is how the two sides are made to
  // describe the same interval instead of two windows offset by the zone difference. A row whose
  // account timezone has no entry here falls back to the site-timezone figures above.
  onsiteByTimezone?: Map<string, OnsiteBundle>;
  // Per (funnelId, currency) -- NOT pre-collapsed to one entry per funnel, because collapsing
  // across currencies is exactly the bug this shape exists to prevent (see IMPORTANT 3 in the
  // fix report). Order count is currency-agnostic (a conversion is a conversion regardless of
  // settlement currency) and is summed across all currencies for a funnel; revenueMinor is money
  // and is matched only against a platform row in the SAME currency.
  onsiteOrders: OnsiteOrderRow[];
  failedPostbacks: Map<string, number>;
  unassigned: UnassignedCreativeRow[];
  // Keyed by creativeDetailKey(funnelId, currency, connectionId). Optional so existing
  // callers/tests that never populate it keep working; a row simply gets an empty creatives array.
  creativeDetails?: Map<string, CreativeDetailVM[]>;
}

export interface OnsiteBundle {
  clicks: Map<string, number>;
  checkouts: Map<string, number>;
  orders: OnsiteOrderRow[];
}

interface OnsiteLookup {
  clicks: Map<string, number>;
  checkouts: Map<string, number>;
  // Total onsite order count per funnel, summed across ALL currencies: a conversion is a
  // conversion regardless of what currency it settled in, so this is safe to sum (unlike money).
  orderCountByFunnel: Map<string, number>;
  // Onsite revenue per (funnelId, currency): money, so never summed across currencies. A row only
  // gets a revenue comparison when its own currency has a matching entry here.
  revenueByFunnelCurrency: Map<string, number>;
}

function onsiteRevenueKey(funnelId: string, currency: string): string {
  return `${funnelId}::${currency}`;
}

// Keyed by connectionId, NOT platform: account discovery creates one connection per ad account, so
// two connections on the same platform for one funnel is the normal shape, and queryPlatformMetrics
// already produces one row per connection for exactly that reason. Keying by platform alone would
// collapse both connections' creatives into a single expansion with no indication, and the expanded
// rows' spend would stop summing to either parent row's own spend.
function creativeDetailKey(funnelId: string, currency: string, connectionId: string): string {
  return `${funnelId}::${currency}::${connectionId}`;
}

function buildOnsiteLookup(bundle: OnsiteBundle): OnsiteLookup {
  const orderCountByFunnel = new Map<string, number>();
  const revenueByFunnelCurrency = new Map<string, number>();
  for (const o of bundle.orders) {
    orderCountByFunnel.set(o.funnelId, (orderCountByFunnel.get(o.funnelId) ?? 0) + o.orders);
    const key = onsiteRevenueKey(o.funnelId, o.currency);
    revenueByFunnelCurrency.set(key, (revenueByFunnelCurrency.get(key) ?? 0) + o.revenueMinor);
  }
  return { clicks: bundle.clicks, checkouts: bundle.checkouts, orderCountByFunnel, revenueByFunnelCurrency };
}

function emptyTotals(): CurrencyTotals {
  return {
    spendMinor: 0,
    impressions: 0,
    linkClicks: 0,
    platformCheckoutInit: null,
    platformConversions: 0,
    platformRevenueMinor: 0,
    onsiteClicks: 0,
    onsiteCheckouts: 0,
    onsiteOrders: 0,
    onsiteRevenueMinor: 0,
  };
}

// Pure so it is unit-testable without a database; loadAdReconciliation below does the I/O and
// hands this the already-fetched raw rows plus the lookup tables (funnel names, connection info)
// needed to decorate them.
export function assembleReconciliation(raw: RawReconciliationInput, ctx: ReconciliationContext): AdReconciliationVM {
  const groups = new Map<string, CurrencyGroup>();
  const groupFor = (currency: string): CurrencyGroup => {
    const existing = groups.get(currency);
    if (existing) return existing;
    const created: CurrencyGroup = {
      currency,
      totals: emptyTotals(),
      unattributedSpendMinor: 0,
      unattributedCreatives: 0,
      rows: [],
    };
    groups.set(currency, created);
    return created;
  };

  // Per-funnel count of unassigned creatives whose page match makes this funnel a candidate.
  // Sourced from queryUnassignedCreatives (which already resolves candidateFunnelIds), NOT from
  // PlatformMetricRow -- that column is computed inside the (funnelId, platform, connectionId,
  // currency) bucket, where AMBIGUOUS/UNMATCHED creatives always carry funnelId = null, so it can
  // never be nonzero on a real funnel row (this was IMPORTANT-1: UNASSIGNED_CREATIVES dead code).
  const unassignedCountByFunnel = new Map<string, number>();
  for (const u of raw.unassigned) {
    for (const funnelId of u.candidateFunnelIds) {
      unassignedCountByFunnel.set(funnelId, (unassignedCountByFunnel.get(funnelId) ?? 0) + 1);
    }
  }

  // Offsets are resolved once per zone, at a single instant, so every row in one render agrees on
  // whether its account is aligned even if the range straddles a daylight-saving change.
  const now = new Date();
  const offsetCache = new Map<string, number | null>();
  const offsetOf = (tz: string): number | null => {
    if (!offsetCache.has(tz)) offsetCache.set(tz, timezoneOffsetMinutes(tz, now));
    return offsetCache.get(tz) ?? null;
  };
  const siteOffset = offsetOf(ctx.siteTimezone);

  const siteOnsite = buildOnsiteLookup({
    clicks: raw.onsiteClicks,
    checkouts: raw.onsiteCheckouts ?? new Map(),
    orders: raw.onsiteOrders,
  });
  const onsiteLookupCache = new Map<string, OnsiteLookup>();
  const onsiteFor = (timezone: string): OnsiteLookup => {
    const bundle = raw.onsiteByTimezone?.get(timezone);
    if (!bundle) return siteOnsite;
    const cached = onsiteLookupCache.get(timezone);
    if (cached) return cached;
    const built = buildOnsiteLookup(bundle);
    onsiteLookupCache.set(timezone, built);
    return built;
  };

  // onsiteClicks/onsiteOrdersCount/onsiteRevenueMinor below are computed per FUNNEL (see the maps
  // above), but queryPlatformMetrics yields one row per (funnel, platform, CONNECTION) -- a funnel
  // with several connections on the same platform is the normal shape (account discovery creates
  // one connection per ad account). Track which (currency, funnelId) pairs have already
  // contributed to a group's totals so a funnel's onsite figures are added once per currency
  // group, not once per connection row.
  const onsiteCountedForCurrencyFunnel = new Set<string>();

  for (const row of raw.platform) {
    const group = groupFor(row.currency);

    // Rule: spend with no effective funnel is reported separately and never becomes a row --
    // otherwise the page would imply funnel rows sum to total spend, and money disappears.
    if (row.funnelId === null) {
      group.unattributedSpendMinor += row.spendMinor;
      continue;
    }

    const connection = ctx.connections.get(row.connectionId);
    const accountTimezone = connection?.timezone ?? ctx.siteTimezone;
    const accountLabel = connection?.label ?? row.connectionId;
    const connectionExpired = connection?.expired ?? false;

    // Bucketed in the AD ACCOUNT's reporting timezone when the caller supplied that bucketing, so
    // this row's two numbers describe the same interval. Consequence worth knowing: such a row's
    // onsite figures will not match the site-wide dashboard for the same picked range, because the
    // range itself means a different set of instants once cut on a different calendar.
    const timezoneAligned = offsetOf(accountTimezone) === siteOffset;
    const onsite = onsiteFor(accountTimezone);
    const onsiteClicks = onsite.clicks.get(row.funnelId) ?? 0;
    const onsiteOrdersCount = onsite.orderCountByFunnel.get(row.funnelId) ?? 0;
    const failedPostbacks = raw.failedPostbacks.get(row.funnelId) ?? 0;
    const unassignedCreativesForFunnel = unassignedCountByFunnel.get(row.funnelId) ?? 0;

    // Revenue is only comparable when this funnel has an onsite figure in the SAME currency as
    // the platform row. If the funnel has no onsite orders at all, that is a real zero (compare
    // normally); if it has orders but only in some other currency, that is a currency mismatch,
    // not a zero -- do not diff, and surface the reason instead.
    const revenueKey = onsiteRevenueKey(row.funnelId, row.currency);
    const matchedRevenue = onsite.revenueByFunnelCurrency.get(revenueKey);
    const hasOtherCurrencyOrders = onsiteOrdersCount > 0 && matchedRevenue === undefined;
    const onsiteRevenueMinor = hasOtherCurrencyOrders ? null : (matchedRevenue ?? 0);

    // Null linkClicks means the platform reports a single click figure that already excludes
    // engagement clicks, so it is the link-click number for that platform.
    const platformLinkClicks = row.linkClicks ?? row.clicks;
    const onsiteCheckouts = onsite.checkouts.get(row.funnelId) ?? 0;

    const clicksDiff = computeDiff({ metric: 'clicks', platform: platformLinkClicks, onsite: onsiteClicks });
    const checkoutInitDiff =
      row.initiateCheckout === null
        ? null
        : computeDiff({ metric: 'checkoutInit', platform: row.initiateCheckout, onsite: onsiteCheckouts });
    const conversionsDiff = computeDiff({ metric: 'conversions', platform: row.conversions, onsite: onsiteOrdersCount });
    const revenueDiff =
      onsiteRevenueMinor === null
        ? null
        : computeDiff({ metric: 'revenueMinor', platform: row.conversionValueMinor, onsite: onsiteRevenueMinor });

    const reasons = detectConflictReasons({
      accountTimezone,
      siteTimezone: ctx.siteTimezone,
      timezoneOffsetsDiffer: !timezoneAligned,
      failedPostbacks,
      connectionExpired,
      ambiguousCreatives: unassignedCreativesForFunnel,
      platformConversions: row.conversions,
      revenueCurrencyUnavailable: hasOtherCurrencyOrders,
    });

    group.totals.spendMinor += row.spendMinor;
    group.totals.impressions += row.impressions;
    group.totals.linkClicks += platformLinkClicks;
    // Sum only the reporting platforms; a platform that never reports checkout starts must not
    // drag a real total down toward zero (null means "not reported", not "reported as zero").
    if (row.initiateCheckout != null) {
      group.totals.platformCheckoutInit = (group.totals.platformCheckoutInit ?? 0) + row.initiateCheckout;
    }
    group.totals.platformConversions += row.conversions;
    group.totals.platformRevenueMinor += row.conversionValueMinor;

    const onsiteCountKey = `${row.currency}::${row.funnelId}`;
    if (!onsiteCountedForCurrencyFunnel.has(onsiteCountKey)) {
      onsiteCountedForCurrencyFunnel.add(onsiteCountKey);
      group.totals.onsiteClicks += onsiteClicks;
      group.totals.onsiteCheckouts += onsiteCheckouts;
      group.totals.onsiteOrders += onsiteOrdersCount;
      if (onsiteRevenueMinor != null) group.totals.onsiteRevenueMinor += onsiteRevenueMinor;
    }

    group.rows.push({
      funnelId: row.funnelId,
      funnelName: ctx.funnelNames.get(row.funnelId) ?? row.funnelId,
      platform: row.platform,
      accountLabel,
      accountTimezone,
      siteTimezone: ctx.siteTimezone,
      timezoneAligned,
      spendMinor: row.spendMinor,
      impressions: row.impressions,
      linkClicks: platformLinkClicks,
      platformCheckoutInit: row.initiateCheckout,
      onsiteCheckouts,
      checkoutInitDiff,
      platformConversions: row.conversions,
      onsiteOrders: onsiteOrdersCount,
      conversionsDiff,
      platformRevenueMinor: row.conversionValueMinor,
      onsiteRevenueMinor,
      revenueDiff,
      clicksDiff,
      onsiteClicks,
      reasons,
      creatives: raw.creativeDetails?.get(creativeDetailKey(row.funnelId, row.currency, row.connectionId)) ?? [],
    });
  }

  // Unattributed-creative count: EVERY unassigned creative in this currency, AMBIGUOUS and
  // UNMATCHED alike, so it counts the same population unattributedSpendMinor sums (IMPORTANT-2).
  // A separate pass (not folded into the funnelId===null branch above) because an unassigned
  // creative's currency may have no funnelId === null platform row of its own to piggyback on.
  for (const u of raw.unassigned) {
    groupFor(u.currency).unattributedCreatives += 1;
  }

  const staleConnections = [...new Set([...ctx.connections.values()].filter((c) => c.expired).map((c) => c.label))];

  return {
    currencyGroups: [...groups.values()],
    unassigned: [...raw.unassigned].sort((a, b) => b.spendMinor - a.spendMinor),
    staleConnections,
  };
}

const healthEvaluator = new ConnectionHealthEvaluator();

export async function loadAdReconciliation(input: {
  start: Date;
  end: Date;
  funnelId?: string;
  // Calendar-day strings in the SITE timezone, already computed by the caller (e.g.
  // resolveAnalyticsWindow's startDateStr/endDateStr). Preferred over deriving from `start`/`end`
  // below because a caller may know the exact days the user picked more precisely than any
  // Date-to-timezone conversion can reconstruct. When omitted, falls back to converting `start`/
  // `end` to calendar days in the site timezone -- NEVER via `toISOString` (UTC), which silently
  // shifts the range on every site timezone that is not UTC (see the ads-insights fix report).
  startDateStr?: string;
  endDateStr?: string;
}): Promise<AdReconciliationVM> {
  const tenantId = getCurrentTenantId();
  const siteTimezone = await getSiteTimezone();
  // Zone ids are not comparable as strings (Etc/GMT+8 is UTC-8), and an account already on the
  // site's clock needs no second set of onsite queries.
  const nowForOffsets = new Date();
  const siteOffsetMinutes = timezoneOffsetMinutes(siteTimezone, nowForOffsets);
  const sameClockAsSite = (tz: string) => timezoneOffsetMinutes(tz, nowForOffsets) === siteOffsetMinutes;
  const startDate = input.startDateStr ?? isoDateInTz(input.start, siteTimezone);
  const endDate = input.endDateStr ?? isoDateInTz(input.end, siteTimezone);

  const [platformRows, clickRows, checkoutRows, orderRows, postbackRows, unassignedRows, connectionRows, funnelRows] =
    await Promise.all([
      queryPlatformMetrics(startDate, endDate),
      queryOnsiteClicksByFunnel(startDate, endDate, siteTimezone),
      queryOnsiteCheckoutsByFunnel(startDate, endDate, siteTimezone),
      queryOnsiteOrdersByFunnel(startDate, endDate, siteTimezone),
      queryFailedPostbackCounts(input.start, input.end),
      queryUnassignedCreatives(startDate, endDate),
      getBasePrisma().adAccountConnection.findMany({
        where: { tenantId },
        select: { id: true, externalAccountId: true, reportingTimezone: true, status: true },
      }),
      getBasePrisma().funnel.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    ]);

  const platform = input.funnelId ? platformRows.filter((r) => r.funnelId === input.funnelId) : platformRows;

  // Re-bucket the onsite side into each ad account's own reporting timezone so every row compares
  // two numbers cut on the SAME calendar. Only the onsite side can move: its events are stored as
  // instants, while a platform's daily report is already cut on the account's calendar and cannot
  // be re-cut without an hourly breakdown we do not fetch. Zones equal to the site zone are skipped
  // (the site-timezone rows above already cover them) and only zones that actually appear on a row
  // in this window are queried, so the common single-account case costs no extra round trip.
  const zonesInPlay = new Set(
    connectionRows
      .filter((c) => platform.some((r) => r.connectionId === c.id))
      .map((c) => c.reportingTimezone)
      .filter((tz): tz is string => !!tz && !sameClockAsSite(tz)),
  );
  const zoneList = [...zonesInPlay];
  const zoneBundles = await Promise.all(
    zoneList.map(async (tz) => {
      const [clicks, checkouts, orders] = await Promise.all([
        queryOnsiteClicksByFunnel(startDate, endDate, tz),
        queryOnsiteCheckoutsByFunnel(startDate, endDate, tz),
        queryOnsiteOrdersByFunnel(startDate, endDate, tz),
      ]);
      return [
        tz,
        {
          clicks: new Map(clicks.map((r) => [r.funnelId, r.clicks])),
          checkouts: new Map(checkouts.map((r) => [r.funnelId, r.checkouts])),
          orders,
        },
      ] as const;
    }),
  );
  const onsiteByTimezone = new Map<string, OnsiteBundle>(zoneBundles);

  // queryUnassignedCreatives is tenant-wide by construction (an unassigned creative has no
  // effective funnelId to filter by at the SQL level). A funnel-scoped call must scope it here,
  // by the same candidateFunnelIds a real funnel row's UNASSIGNED_CREATIVES reason already keys
  // off of -- otherwise assembleReconciliation's unconditional loop over raw.unassigned (see
  // "Unattributed-creative count" below) leaks every OTHER funnel's ambiguous/unmatched creatives
  // into this funnel's currencyGroups and unassigned list.
  const unassigned = input.funnelId
    ? unassignedRows.filter((u) => u.candidateFunnelIds.includes(input.funnelId as string))
    : unassignedRows;

  // One creative-detail query per distinct (funnelId, currency, connectionId) triple that actually
  // appears on a row -- NOT per (funnelId, currency) alone. queryPlatformMetrics already produces
  // one row per connection (account discovery creates one connection per ad account, so a funnel
  // with several connections on the same platform is the normal shape), so the triple, not the
  // pair, is what uniquely identifies a row's own creatives.
  const tripleKeys = new Set<string>();
  const triples: Array<{ funnelId: string; currency: string; connectionId: string }> = [];
  for (const row of platform) {
    if (row.funnelId === null) continue;
    const key = creativeDetailKey(row.funnelId, row.currency, row.connectionId);
    if (tripleKeys.has(key)) continue;
    tripleKeys.add(key);
    triples.push({ funnelId: row.funnelId, currency: row.currency, connectionId: row.connectionId });
  }
  const creativeDetailResults = await Promise.all(
    triples.map((t) => queryCreativeDetailsByFunnel(t.funnelId, t.connectionId, t.currency, startDate, endDate)),
  );
  const creativeDetails = new Map<string, CreativeDetailVM[]>();
  triples.forEach((t, i) => {
    creativeDetails.set(creativeDetailKey(t.funnelId, t.currency, t.connectionId), creativeDetailResults[i]);
  });

  const raw: RawReconciliationInput = {
    platform,
    onsiteClicks: new Map(clickRows.map((r) => [r.funnelId, r.clicks])),
    onsiteCheckouts: new Map(checkoutRows.map((r) => [r.funnelId, r.checkouts])),
    onsiteByTimezone,
    onsiteOrders: orderRows,
    failedPostbacks: new Map(postbackRows.map((r) => [r.funnelId, r.count])),
    unassigned,
    creativeDetails,
  };

  const ctx: ReconciliationContext = {
    siteTimezone,
    funnelNames: new Map(funnelRows.map((f) => [f.id, f.name])),
    connections: new Map(
      connectionRows.map((c) => [
        c.id,
        {
          label: c.externalAccountId,
          timezone: c.reportingTimezone ?? siteTimezone,
          expired: healthEvaluator.isDegraded({ status: c.status as ConnectionStatus }),
        },
      ]),
    ),
  };

  return assembleReconciliation(raw, ctx);
}
