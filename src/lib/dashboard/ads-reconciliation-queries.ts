import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { PAID_ORDER_STATUSES } from './funnel-stats-queries';
import { buildPageIndex, type PageRef, type FunnelRef } from '@/modules/acquisition-ads/domain/services/url-attribution';

export interface PlatformMetricRow {
  funnelId: string | null;
  platform: string;
  connectionId: string;
  currency: string;
  spendMinor: number;
  impressions: number;
  clicks: number;
  linkClicks: number | null;
  conversions: number;
  initiateCheckout: number | null;
  conversionValueMinor: number;
}

// COALESCE puts the manual assignment ahead of the computed one. AMBIGUOUS and UNMATCHED
// creatives fall out with a null funnelId and are reported separately, never folded into a funnel.
// No ambiguous/unassigned creative count here: that count cannot mean anything at this grouping --
// AMBIGUOUS and UNMATCHED creatives always land in the funnelId = null bucket alongside every other
// platform/connection, so a per-(funnelId, platform, connectionId) count would structurally always
// be 0 for every row that has a real funnelId. See queryUnassignedCreatives for that count instead,
// resolved per funnel via each creative's candidateFunnelIds.
export async function queryPlatformMetrics(startDate: string, endDate: string): Promise<PlatformMetricRow[]> {
  const sql = `
    SELECT
      COALESCE(c."manualFunnelId", c."autoFunnelId") AS "funnelId",
      c."platform"                                   AS "platform",
      c."connectionId"                               AS "connectionId",
      m."currency"                                   AS "currency",
      SUM(m."spendMinor")::bigint                    AS "spendMinor",
      SUM(m."impressions")::bigint                   AS "impressions",
      SUM(m."clicks")::bigint                        AS "clicks",
      SUM(m."linkClicks")::bigint                    AS "linkClicks",
      SUM(m."conversions")::float8                   AS "conversions",
      SUM(m."initiateCheckout")::float8              AS "initiateCheckout",
      SUM(COALESCE(m."conversionValueMinor", 0))::bigint AS "conversionValueMinor"
    FROM "ad_daily_metrics" m
    JOIN "ad_creatives" c ON c."id" = m."creativeId" AND c."tenantId" = m."tenantId"
    WHERE m."tenantId" = $1 AND m."date" >= $2::date AND m."date" <= $3::date
    GROUP BY 1, 2, 3, 4`;
  const rows = await getBasePrisma().$queryRawUnsafe<any[]>(sql, getCurrentTenantId(), startDate, endDate);
  return rows.map((r) => ({
    funnelId: r.funnelId ?? null,
    platform: String(r.platform),
    connectionId: String(r.connectionId),
    currency: String(r.currency),
    spendMinor: Number(r.spendMinor ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    linkClicks: r.linkClicks == null ? null : Number(r.linkClicks),
    conversions: Number(r.conversions ?? 0),
    initiateCheckout: r.initiateCheckout == null ? null : Number(r.initiateCheckout),
    conversionValueMinor: Number(r.conversionValueMinor ?? 0),
  }));
}

export interface OnsiteClickRow {
  funnelId: string;
  clicks: number;
}

// Distinct page_view visitors per funnel, bucketed by calendar day IN THE SITE'S OWN TIMEZONE.
// The AT TIME ZONE double-cast (stored instant read as UTC, then shifted into the target zone)
// happens entirely in SQL -- node-pg would otherwise localize the timestamp to this host's zone.
export async function queryOnsiteClicksByFunnel(
  startDate: string,
  endDate: string,
  timezone: string,
): Promise<OnsiteClickRow[]> {
  const sql = `
    SELECT "funnelId" AS "funnelId", COUNT(DISTINCT "visitorId")::int AS "clicks"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "kind" = 'page_view' AND "funnelId" IS NOT NULL
      AND ("occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
    GROUP BY "funnelId"`;
  const rows = await getBasePrisma().$queryRawUnsafe<any[]>(sql, getCurrentTenantId(), startDate, endDate, timezone);
  return rows.map((r) => ({ funnelId: String(r.funnelId), clicks: Number(r.clicks ?? 0) }));
}

export interface AdFunnelTotalsRow {
  funnelId: string;
  impressions: number;
  linkClicks: number;
  initiateCheckout: number | null;
  conversions: number;
  // Reporting zones of the ad accounts behind these numbers. The platform's days are cut on these
  // calendars while the onsite steps are cut on the operator's picked zone, and unlike the
  // reconciliation rows the funnel stages cannot be re-bucketed (their onsite side comes from
  // pre-aggregated rollups). Carried so the UI can say so rather than imply a false alignment.
  platformTimezones: string[];
}

// Counts only, summed across every currency the funnel's ad accounts report in. Impressions,
// clicks and conversion COUNTS are currency-agnostic, so summing them is safe -- money is not, and
// deliberately has no column here. Use the per-currency reconciliation rows for spend and revenue.
// Rows with no effective funnel are excluded rather than folded in: unattributed spend belongs to
// no funnel, and attributing its clicks to one would make the conversion funnel read high.
export async function queryAdFunnelTotals(startDate: string, endDate: string): Promise<AdFunnelTotalsRow[]> {
  const sql = `
    SELECT
      COALESCE(c."manualFunnelId", c."autoFunnelId") AS "funnelId",
      SUM(m."impressions")::bigint                   AS "impressions",
      SUM(COALESCE(m."linkClicks", m."clicks"))::bigint AS "linkClicks",
      SUM(m."initiateCheckout")::float8              AS "initiateCheckout",
      SUM(m."conversions")::float8                   AS "conversions",
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT conn."reportingTimezone"), NULL) AS "platformTimezones"
    FROM "ad_daily_metrics" m
    JOIN "ad_creatives" c ON c."id" = m."creativeId" AND c."tenantId" = m."tenantId"
    LEFT JOIN "AdAccountConnection" conn ON conn."id" = c."connectionId" AND conn."tenantId" = c."tenantId"
    WHERE m."tenantId" = $1 AND m."date" >= $2::date AND m."date" <= $3::date
      AND COALESCE(c."manualFunnelId", c."autoFunnelId") IS NOT NULL
    GROUP BY 1`;
  const rows = await getBasePrisma().$queryRawUnsafe<any[]>(sql, getCurrentTenantId(), startDate, endDate);
  return rows.map((r) => ({
    funnelId: String(r.funnelId),
    impressions: Number(r.impressions ?? 0),
    linkClicks: Number(r.linkClicks ?? 0),
    initiateCheckout: r.initiateCheckout == null ? null : Number(r.initiateCheckout),
    conversions: Number(r.conversions ?? 0),
    platformTimezones: ((r.platformTimezones as string[] | null) ?? []).map(String),
  }));
}

export interface OnsiteCheckoutRow {
  funnelId: string;
  checkouts: number;
}

// Onsite counterpart of the platform's checkout-start metric: distinct visitors that reached a
// checkout step. Same site-timezone day bucketing as the clicks query above. Counts visitors, not
// events, so a visitor who bounces back and forth between checkout and the landing page once is
// one checkout start -- matching how the platforms deduplicate their own initiate-checkout counts.
export async function queryOnsiteCheckoutsByFunnel(
  startDate: string,
  endDate: string,
  timezone: string,
): Promise<OnsiteCheckoutRow[]> {
  const sql = `
    SELECT "funnelId" AS "funnelId", COUNT(DISTINCT "visitorId")::int AS "checkouts"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "kind" = 'checkout_view' AND "funnelId" IS NOT NULL
      AND ("occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
    GROUP BY "funnelId"`;
  const rows = await getBasePrisma().$queryRawUnsafe<any[]>(sql, getCurrentTenantId(), startDate, endDate, timezone);
  return rows.map((r) => ({ funnelId: String(r.funnelId), checkouts: Number(r.checkouts ?? 0) }));
}

export interface OnsiteOrderRow {
  funnelId: string;
  currency: string;
  orders: number;
  revenueMinor: number;
}

// Orders carry their funnel via the attribution JSON blob (Order has no funnelId column), same
// join `queryAttributedOrders` uses. Same AT TIME ZONE day bucketing as the clicks query above.
// Grouped by currency too: capturedTotal must never be summed across currencyCode values, and the
// assembly layer needs a per-currency figure to avoid diffing revenue in the wrong currency.
export async function queryOnsiteOrdersByFunnel(
  startDate: string,
  endDate: string,
  timezone: string,
): Promise<OnsiteOrderRow[]> {
  const sql = `
    SELECT o."attribution"->>'funnelId' AS "funnelId",
           o."currencyCode" AS "currency",
           COUNT(*)::int AS "orders",
           SUM(o."capturedTotal")::bigint AS "revenueMinor"
    FROM "orders" o
    WHERE o."tenantId" = $1
      AND o."attribution"->>'funnelId' IS NOT NULL
      AND o."status"::text = ANY($5)
      AND (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
    GROUP BY o."attribution"->>'funnelId', o."currencyCode"`;
  const rows = await getBasePrisma().$queryRawUnsafe<any[]>(
    sql,
    getCurrentTenantId(),
    startDate,
    endDate,
    timezone,
    PAID_ORDER_STATUSES,
  );
  return rows.map((r) => ({
    funnelId: String(r.funnelId),
    currency: String(r.currency),
    orders: Number(r.orders ?? 0),
    revenueMinor: Number(r.revenueMinor ?? 0),
  }));
}

export interface FailedPostbackRow {
  funnelId: string;
  count: number;
}

// A Postback event carries no funnelId of its own (it fires off an order/session, not an ad
// click). It is attributed to a funnel by walking destinationId -> connectionId -> the formal
// reporting binding (funnel_ad_connections) directly. Deliberately does NOT require a resolved
// ad_creatives match: a freshly wired connection with zero matched creatives yet is exactly the
// highest-risk window for a broken conversion setup, and requiring a creative match would hide
// failures during precisely that window. A connection bound to more than one funnel attributes
// the failure to each of them (funnel_ad_connections already de-duplicates (funnelId, connectionId)
// pairs, so this cannot double count a single binding).
// Postback.createdAt is a plain instant (no per-account calendar-day semantics apply here), so
// this compares directly against the caller's UTC range instead of bucketing by any timezone.
export async function queryFailedPostbackCounts(start: Date, end: Date): Promise<FailedPostbackRow[]> {
  const sql = `
    SELECT fac."funnelId" AS "funnelId", COUNT(*)::int AS "count"
    FROM "Postback" pb
    JOIN "AdConversionDestination" dest ON dest."id" = pb."destinationId" AND dest."tenantId" = pb."tenantId"
    JOIN "funnel_ad_connections" fac ON fac."connectionId" = dest."connectionId" AND fac."tenantId" = pb."tenantId"
    WHERE pb."tenantId" = $1 AND pb."status" = 'FAILED' AND pb."createdAt" >= $2 AND pb."createdAt" < $3
    GROUP BY fac."funnelId"`;
  const rows = await getBasePrisma().$queryRawUnsafe<any[]>(sql, getCurrentTenantId(), start, end);
  return rows.map((r) => ({ funnelId: String(r.funnelId), count: Number(r.count ?? 0) }));
}

export interface CreativeDetailRow {
  creativeId: string;
  platform: string;
  name: string;
  campaignName: string | null;
  // Two ads can share a name and differ only by ad set (duplicating an ad into a new ad set is the
  // normal way to test one creative against another audience), so the ad set is what tells the
  // two expansion rows apart.
  adsetName: string | null;
  destinationUrl: string | null;
  spendMinor: number;
  impressions: number;
  clicks: number;
  linkClicks: number | null;
  conversions: number;
  initiateCheckout: number | null;
}

// Per-creative breakdown for one row's expansion UI. Scoped to a single funnel, a single currency
// (money must never mix currencies -- see the file-level rule), AND a single connectionId, using
// the exact same "effective funnel" resolution queryPlatformMetrics uses
// (COALESCE(manualFunnelId, autoFunnelId)), so the sum of these rows' spendMinor matches that exact
// PlatformMetricRow's spendMinor for (funnelId, platform, connectionId, currency).
//
// The connectionId predicate is load-bearing, not cosmetic: account discovery creates one
// connection per ad account, so a funnel with two connections on the same platform is the normal
// shape for any operator running more than one ad account on a platform, not a rare edge case.
// queryPlatformMetrics already produces one row per connection for exactly that reason; this query
// must scope the same way, or two connections' expansions collapse into one combined creative list
// with no indication, and the expanded rows' spend stops summing to the parent row's own spend.
export async function queryCreativeDetailsByFunnel(
  funnelId: string,
  connectionId: string,
  currency: string,
  startDate: string,
  endDate: string,
): Promise<CreativeDetailRow[]> {
  const sql = `
    SELECT
      c."id"             AS "creativeId",
      c."platform"       AS "platform",
      c."name"           AS "name",
      c."campaignName"   AS "campaignName",
      c."adsetName"      AS "adsetName",
      c."destinationUrl" AS "destinationUrl",
      SUM(m."spendMinor")::bigint  AS "spendMinor",
      SUM(m."impressions")::bigint AS "impressions",
      SUM(m."clicks")::bigint      AS "clicks",
      SUM(m."linkClicks")::bigint  AS "linkClicks",
      SUM(m."conversions")::float8 AS "conversions",
      SUM(m."initiateCheckout")::float8 AS "initiateCheckout"
    FROM "ad_creatives" c
    JOIN "ad_daily_metrics" m ON m."creativeId" = c."id" AND m."tenantId" = c."tenantId"
    WHERE c."tenantId" = $1
      AND COALESCE(c."manualFunnelId", c."autoFunnelId") = $2
      AND c."connectionId" = $3
      AND m."currency" = $4
      AND m."date" >= $5::date AND m."date" <= $6::date
    GROUP BY c."id", c."platform", c."name", c."campaignName", c."adsetName", c."destinationUrl"
    ORDER BY "spendMinor" DESC`;
  const rows = await getBasePrisma().$queryRawUnsafe<any[]>(
    sql,
    getCurrentTenantId(),
    funnelId,
    connectionId,
    currency,
    startDate,
    endDate,
  );
  return rows.map((r) => ({
    creativeId: String(r.creativeId),
    platform: String(r.platform),
    name: String(r.name),
    campaignName: r.campaignName == null ? null : String(r.campaignName),
    adsetName: r.adsetName == null ? null : String(r.adsetName),
    destinationUrl: r.destinationUrl == null ? null : String(r.destinationUrl),
    spendMinor: Number(r.spendMinor ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    linkClicks: r.linkClicks == null ? null : Number(r.linkClicks),
    conversions: Number(r.conversions ?? 0),
    initiateCheckout: r.initiateCheckout == null ? null : Number(r.initiateCheckout),
  }));
}

export interface UnassignedCreativeRow {
  creativeId: string;
  platform: string;
  name: string;
  destinationUrl: string | null;
  normalizedPath: string | null;
  matchState: string;
  spendMinor: number;
  currency: string;
  candidateFunnelIds: string[];
}

// One row per creative with no effective funnel (see the WHERE clause below), so the operator's
// "unassigned creatives" list never omits a leak and never double counts a creative that already
// resolved. candidateFunnelIds is NOT persisted anywhere on AdCreative -- it is recomputed here
// from the CURRENT pages/funnels via the same buildPageIndex the sync path uses, so an AMBIGUOUS
// creative's dropdown reflects live funnel-to-page bindings rather than a stale sync-time snapshot.
export async function queryUnassignedCreatives(startDate: string, endDate: string): Promise<UnassignedCreativeRow[]> {
  const tenantId = getCurrentTenantId();
  const sql = `
    SELECT
      c."id"             AS "creativeId",
      c."platform"       AS "platform",
      c."name"           AS "name",
      c."destinationUrl" AS "destinationUrl",
      c."normalizedPath" AS "normalizedPath",
      c."matchState"     AS "matchState",
      m."currency"       AS "currency",
      SUM(m."spendMinor")::bigint AS "spendMinor"
    FROM "ad_creatives" c
    JOIN "ad_daily_metrics" m ON m."creativeId" = c."id" AND m."tenantId" = c."tenantId"
    WHERE c."tenantId" = $1
      AND c."manualFunnelId" IS NULL
      AND (c."autoFunnelId" IS NULL OR c."matchState" <> 'MATCHED')
      AND m."date" >= $2::date AND m."date" <= $3::date
    GROUP BY c."id", c."platform", c."name", c."destinationUrl", c."normalizedPath", c."matchState", m."currency"`;
  const rows = await getBasePrisma().$queryRawUnsafe<any[]>(sql, tenantId, startDate, endDate);

  const [pages, funnels] = await Promise.all([
    getBasePrisma().page.findMany({ where: { tenantId }, select: { id: true, slug: true } }) as Promise<PageRef[]>,
    getBasePrisma().funnel.findMany({ where: { tenantId }, select: { id: true, steps: true } }) as Promise<
      FunnelRef[]
    >,
  ]);
  const index = buildPageIndex(pages, funnels);

  return rows.map((r) => {
    const normalizedPath = r.normalizedPath == null ? null : String(r.normalizedPath);
    const pageId = normalizedPath ? (index.pageIdByPath.get(normalizedPath) ?? null) : null;
    const candidateFunnelIds = pageId ? (index.funnelIdsByPageId.get(pageId) ?? []) : [];
    return {
      creativeId: String(r.creativeId),
      platform: String(r.platform),
      name: String(r.name),
      destinationUrl: r.destinationUrl == null ? null : String(r.destinationUrl),
      normalizedPath,
      matchState: String(r.matchState),
      spendMinor: Number(r.spendMinor ?? 0),
      currency: String(r.currency),
      candidateFunnelIds,
    };
  });
}
