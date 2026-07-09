import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { createEmptyStats } from '@/lib/adapters/payment/stats-config.client';
import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { buildRevenueMetrics } from '@/lib/stats/diagnostics';
import type { RevenueMetricsDto } from '@/lib/stats/diagnostics';
import type { StatsDataItemDto, FunnelStatsBag } from '@/contracts/stats';

export interface StatsQuery {
  funnelId?: string;
  fromBucketKey: string;
  toBucketKey: string;
}

const PAID_ORDER_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'SHIPPED', 'DELIVERED'];

// provider string (metadata->>'provider') -> per-provider column keys in stats-config.client.ts
const PROVIDER_COLUMNS: Record<string, { click: string; success: string; error: string }> = {
  paypal: { click: 'paypalButtonClick', success: 'paypalPayment', error: 'paypalError' },
  stripe: { click: 'stripeSubmit', success: 'stripePayment', error: 'stripeDeclined' },
};

interface TimeWindow {
  from?: Date;
  to?: Date;
}

function parseWindow(query: StatsQuery): TimeWindow {
  const from = parseBoundary(query.fromBucketKey);
  const to = parseBoundary(query.toBucketKey);
  return { from, to };
}

function parseBoundary(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

interface CountRow {
  funnelId: string;
  kind: string;
  visitors: number;
}

interface ProviderCountRow {
  funnelId: string;
  kind: string;
  provider: string | null;
  visitors: number;
}

interface RevenueRow {
  funnelId: string;
  revenueMinor: number;
  orders: number;
}

interface VisitorRow {
  funnelId: string;
  enteringVisitors: number;
  convertingVisitors: number;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

function windowClause(window: TimeWindow, params: unknown[], column: string): string {
  const parts: string[] = [];
  if (window.from) {
    params.push(window.from);
    parts.push(`${column} >= $${params.length}`);
  }
  if (window.to) {
    params.push(window.to);
    parts.push(`${column} <= $${params.length}`);
  }
  return parts.length ? ` AND ${parts.join(' AND ')}` : '';
}

// Distinct funnel-stage visitors per funnel + stage kind. Page/checkout stages come from
// user_activity_events (page_view -> 'page_view', checkout_view -> 'checkout_started'); the
// conversion stage ('payment_captured') is the distinct converting visitor count from paid
// orders attributed to the funnel. Downstream buildBag keys off these exact kind strings.
async function loadFunnelStageCounts(funnelIds: string[], window: TimeWindow): Promise<CountRow[]> {
  if (funnelIds.length === 0) return [];
  const activityParams: unknown[] = [getCurrentTenantId(), funnelIds];
  const activityTime = windowClause(window, activityParams, '"occurredAt"');
  const activitySql = `
    SELECT "funnelId" AS "funnelId",
           CASE "kind" WHEN 'checkout_view' THEN 'checkout_started' ELSE "kind" END AS "kind",
           COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1
      AND "funnelId" = ANY($2)
      AND "kind" IN ('page_view', 'checkout_view')${activityTime}
    GROUP BY "funnelId", "kind"`;
  const orderParams: unknown[] = [getCurrentTenantId(), funnelIds, PAID_ORDER_STATUSES];
  const orderTime = windowClause(window, orderParams, 'o."createdAt"');
  const orderSql = `
    SELECT o."attribution"->>'funnelId' AS "funnelId",
           'payment_captured' AS "kind",
           COUNT(DISTINCT o."attribution"->>'visitorId')::int AS "visitors"
    FROM "orders" o
    WHERE o."tenantId" = $1
      AND o."attribution"->>'funnelId' = ANY($2)
      AND o."status"::text = ANY($3)${orderTime}
    GROUP BY o."attribution"->>'funnelId'`;
  const base = getBasePrisma();
  const [activityRows, orderRows] = await Promise.all([
    base.$queryRawUnsafe<Array<Record<string, unknown>>>(activitySql, ...activityParams),
    base.$queryRawUnsafe<Array<Record<string, unknown>>>(orderSql, ...orderParams),
  ]);
  return [...activityRows, ...orderRows].map((r) => ({
    funnelId: String(r.funnelId),
    kind: String(r.kind),
    visitors: toNumber(r.visitors),
  }));
}

// Distinct behaviour visitors from user_activity_events grouped per funnel + kind.
async function loadActivityCounts(funnelIds: string[], window: TimeWindow): Promise<CountRow[]> {
  if (funnelIds.length === 0) return [];
  const params: unknown[] = [getCurrentTenantId(), funnelIds];
  const time = windowClause(window, params, '"occurredAt"');
  const sql = `
    SELECT "funnelId" AS "funnelId", "kind" AS "kind",
           COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1
      AND "funnelId" = ANY($2)${time}
    GROUP BY "funnelId", "kind"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({ funnelId: String(r.funnelId), kind: String(r.kind), visitors: toNumber(r.visitors) }));
}

// Distinct payment-action visitors grouped per funnel + kind + metadata provider.
async function loadPaymentProviderCounts(funnelIds: string[], window: TimeWindow): Promise<ProviderCountRow[]> {
  if (funnelIds.length === 0) return [];
  const params: unknown[] = [getCurrentTenantId(), funnelIds];
  const time = windowClause(window, params, '"occurredAt"');
  const sql = `
    SELECT "funnelId" AS "funnelId", "kind" AS "kind",
           "metadata"->>'provider' AS "provider",
           COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1
      AND "funnelId" = ANY($2)
      AND "kind" IN ('payment_button_click', 'payment_submit', 'payment_success', 'payment_error')${time}
    GROUP BY "funnelId", "kind", "metadata"->>'provider'`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    funnelId: String(r.funnelId),
    kind: String(r.kind),
    provider: r.provider == null ? null : String(r.provider),
    visitors: toNumber(r.visitors),
  }));
}

// Captured-order revenue (minor units) + order count per funnel, attributed directly via
// o."attribution"->>'funnelId'. UNNEST keeps funnels with zero orders in the result.
async function loadRevenue(funnelIds: string[], window: TimeWindow): Promise<RevenueRow[]> {
  if (funnelIds.length === 0) return [];
  const params: unknown[] = [getCurrentTenantId(), funnelIds, PAID_ORDER_STATUSES];
  const time = windowClause(window, params, 'o."createdAt"');
  const sql = `
    SELECT f."funnelId" AS "funnelId",
           COALESCE(SUM(o."capturedTotal"), 0)::bigint AS "revenueMinor",
           COUNT(o."id")::int AS "orders"
    FROM UNNEST($2::text[]) AS f("funnelId")
    LEFT JOIN "orders" o
      ON o."tenantId" = $1
     AND o."status"::text = ANY($3)
     AND o."attribution"->>'funnelId' = f."funnelId"${time}
    GROUP BY f."funnelId"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    funnelId: String(r.funnelId),
    revenueMinor: toNumber(r.revenueMinor),
    orders: toNumber(r.orders),
  }));
}

// Canonical visitor model per funnel: entering = distinct page_view visitors in the window;
// converting = distinct visitors attributed to a paid funnel order. Both derive directly from
// user_activity_events / orders, so a converting visitor need not appear in the entering window.
async function loadVisitorCounts(funnelIds: string[], window: TimeWindow): Promise<VisitorRow[]> {
  if (funnelIds.length === 0) return [];
  const enterParams: unknown[] = [getCurrentTenantId(), funnelIds];
  const enterTime = windowClause(window, enterParams, '"occurredAt"');
  const enterSql = `
    SELECT "funnelId" AS "funnelId", COUNT(DISTINCT "visitorId")::int AS "enteringVisitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1
      AND "kind" = 'page_view'
      AND "funnelId" = ANY($2)${enterTime}
    GROUP BY "funnelId"`;
  const convertParams: unknown[] = [getCurrentTenantId(), funnelIds, PAID_ORDER_STATUSES];
  const convertTime = windowClause(window, convertParams, 'o."createdAt"');
  const convertSql = `
    SELECT o."attribution"->>'funnelId' AS "funnelId",
           COUNT(DISTINCT o."attribution"->>'visitorId')::int AS "convertingVisitors"
    FROM "orders" o
    WHERE o."tenantId" = $1
      AND o."attribution"->>'funnelId' = ANY($2)
      AND o."status"::text = ANY($3)${convertTime}
    GROUP BY o."attribution"->>'funnelId'`;
  const base = getBasePrisma();
  const [enterRows, convertRows] = await Promise.all([
    base.$queryRawUnsafe<Array<Record<string, unknown>>>(enterSql, ...enterParams),
    base.$queryRawUnsafe<Array<Record<string, unknown>>>(convertSql, ...convertParams),
  ]);
  const merged = new Map<string, VisitorRow>();
  for (const r of enterRows) {
    const funnelId = String(r.funnelId);
    merged.set(funnelId, { funnelId, enteringVisitors: toNumber(r.enteringVisitors), convertingVisitors: 0 });
  }
  for (const r of convertRows) {
    const funnelId = String(r.funnelId);
    const row = merged.get(funnelId) ?? { funnelId, enteringVisitors: 0, convertingVisitors: 0 };
    row.convertingVisitors = toNumber(r.convertingVisitors);
    merged.set(funnelId, row);
  }
  return [...merged.values()];
}

function indexByFunnel<T extends { funnelId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.funnelId) ?? [];
    list.push(row);
    map.set(row.funnelId, list);
  }
  return map;
}

function buildBag(
  stageRows: CountRow[],
  activityRows: CountRow[],
  providerRows: ProviderCountRow[],
  revenue: RevenueRow | undefined,
  visitors: VisitorRow | undefined,
): FunnelStatsBag {
  const bag = createEmptyStats();

  // Canonical headline visitor metrics (session-distinct), kept separate from the funnel-stage
  // page-view columns so the pyramid's Visitors/CVR tiles and the KPI agree.
  bag.enteringVisitors = visitors?.enteringVisitors ?? 0;
  bag.convertingVisitors = visitors?.convertingVisitors ?? 0;

  const stage = new Map(stageRows.map((r) => [r.kind, r.visitors]));
  bag.lp1 = stage.get('page_view') || stage.get('step_view') || 0;
  bag.checkout = stage.get('checkout_started') || 0;
  bag.thankyou = stage.get('payment_captured') || 0;

  const activity = new Map(activityRows.map((r) => [r.kind, r.visitors]));
  bag.productSelected = activity.get('add_to_cart') || 0;
  bag.upsell1 = activity.get('upsell_accept') || 0;
  bag.error = activity.get('js_error') || 0;
  bag.pageLeave = activity.get('page_leave') || 0;

  const clickVisitors = (activity.get('payment_button_click') || 0) + (activity.get('payment_submit') || 0);
  bag.totalUclick = clickVisitors;

  // payment_success activity is the primary signal; fall back to the funnel-event payment_captured
  // count when no client-side success events were recorded.
  bag.totalSuccess = activity.get('payment_success') || bag.thankyou;

  for (const row of providerRows) {
    if (!row.provider) continue;
    const cols = PROVIDER_COLUMNS[row.provider.toLowerCase()];
    if (!cols) continue;
    if (row.kind === 'payment_button_click' || row.kind === 'payment_submit') bag[cols.click] += row.visitors;
    else if (row.kind === 'payment_success') bag[cols.success] += row.visitors;
    else if (row.kind === 'payment_error') bag[cols.error] += row.visitors;
  }

  if (revenue) {
    bag.revenue = revenue.revenueMinor / 100;
    if ('orders' in bag) bag.orders = revenue.orders;
  }

  return bag;
}

export async function loadStatsData(query: StatsQuery): Promise<StatsDataItemDto[]> {
  const { funnels } = makeFunnelDashboard();
  const all = await funnels.list();
  const targets = query.funnelId ? all.filter((f) => f.id === query.funnelId) : all;
  if (targets.length === 0) return [];

  const funnelIds = targets.map((f) => f.id);
  const window = parseWindow(query);

  const [stageCounts, activityCounts, providerCounts, revenueRows, visitorRows] = await Promise.all([
    loadFunnelStageCounts(funnelIds, window).catch(() => [] as CountRow[]),
    loadActivityCounts(funnelIds, window).catch(() => [] as CountRow[]),
    loadPaymentProviderCounts(funnelIds, window).catch(() => [] as ProviderCountRow[]),
    loadRevenue(funnelIds, window).catch(() => [] as RevenueRow[]),
    loadVisitorCounts(funnelIds, window).catch(() => [] as VisitorRow[]),
  ]);

  const stageByFunnel = indexByFunnel(stageCounts);
  const activityByFunnel = indexByFunnel(activityCounts);
  const providerByFunnel = indexByFunnel(providerCounts);
  const revenueByFunnel = new Map(revenueRows.map((r) => [r.funnelId, r]));
  const visitorByFunnel = new Map(visitorRows.map((r) => [r.funnelId, r]));

  return targets.map((f) => {
    const stats = buildBag(
      stageByFunnel.get(f.id) ?? [],
      activityByFunnel.get(f.id) ?? [],
      providerByFunnel.get(f.id) ?? [],
      revenueByFunnel.get(f.id),
      visitorByFunnel.get(f.id),
    );
    return {
      funnelId: f.id,
      funnelName: f.name,
      stats,
      metrics: revenueMetricsFor(stats, revenueByFunnel.get(f.id)),
    };
  });
}

function revenueMetricsFor(stats: FunnelStatsBag, revenue: RevenueRow | undefined): RevenueMetricsDto {
  const visitors = stats.enteringVisitors || 0;
  return buildRevenueMetrics({
    revenueMinor: revenue?.revenueMinor ?? 0,
    orders: revenue?.orders ?? 0,
    visitors,
  });
}
