import { getBasePrisma } from '@/lib/db';
import { getCache, CACHE_TTL } from '@/lib/adapters/cache';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { deriveEntryAttribution } from '@/modules/analytics/domain/value-objects';
import {
  topNWithOther,
  downsampleTrend,
  pickGranularity,
  buildPeriodComparison,
  previousWindow,
  type SegmentRow,
  type SegmentDto,
  type TrendBucketRow,
  type TrendPointDto,
  type PeriodTotals,
} from '@/lib/stats/diagnostics';
import type { SegmentDimension } from '@/contracts/analytics-diagnostics';

const PAID_ORDER_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'SHIPPED', 'DELIVERED'];

const PAYMENT_PROVIDERS = ['stripe', 'paypal'] as const;

const CHECKOUT_STAGES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'checkout_view', label: 'Checkout View' },
  { key: 'shipping_submitted', label: 'Shipping Submitted' },
  { key: 'payment_method_selected', label: 'Payment Method Selected' },
  { key: 'payment_button_click', label: 'Payment Button Click' },
  { key: 'payment_submit', label: 'Payment Submit' },
  { key: 'payment_success', label: 'Payment Success' },
];

export interface DiagnosticsRange {
  funnelId: string;
  from: Date;
  to: Date;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

function cacheKey(view: string, range: DiagnosticsRange, dimension = ''): string {
  return [
    'analytics:diag',
    getCurrentTenantId(),
    range.funnelId,
    view,
    range.from.toISOString(),
    range.to.toISOString(),
    dimension,
  ].join(':');
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cache = getCache();
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;
  const value = await load();
  await cache.set<T>(key, value, CACHE_TTL.SHORT);
  return value;
}

// ── First-touch attribution ───────────────────────────────────────────────────
// The old session row denormalized entryFirstUrl/entryChannel/entryCampaign; with sessions gone we
// rebuild first-touch per visitor from the earliest 'page_view' row in user_activity_events and derive
// channel/campaign from its utm params (deriveEntryAttribution), falling back to the referrer host then
// 'direct' for channel — matching the old denormalization rules.

interface VisitorFirstTouch {
  visitorId: string;
  channel: string | null;
  campaign: string | null;
}

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function deriveSegmentKeys(
  dimension: SegmentDimension,
  firstUrl: string | null,
  referrer: string | null,
): string | null {
  const attribution = firstUrl ? deriveEntryAttribution(firstUrl) : undefined;
  if (dimension === 'campaign') {
    return attribution?.campaign ?? null;
  }
  return attribution?.channel ?? hostOf(referrer) ?? 'direct';
}

// Earliest 'page_view' per visitor scoped to the funnel + window (first-touch). Returns the url and
// referrer of that first hit so channel/campaign can be derived in JS via the shared helper.
async function loadVisitorFirstTouch(
  range: DiagnosticsRange,
  dimension: SegmentDimension,
): Promise<VisitorFirstTouch[]> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to];
  const sql = `
    SELECT DISTINCT ON (e."visitorId")
           e."visitorId" AS "visitorId", e."url" AS "url", e."referrer" AS "referrer"
    FROM "user_activity_events" e
    WHERE e."tenantId" = $1
      AND e."funnelId" = $2
      AND e."kind" = 'page_view'
      AND e."occurredAt" >= $3
      AND e."occurredAt" <= $4
    ORDER BY e."visitorId", e."occurredAt" ASC`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    visitorId: String(r.visitorId),
    channel: deriveSegmentKeys('channel', r.url == null ? null : String(r.url), r.referrer == null ? null : String(r.referrer)),
    campaign: deriveSegmentKeys('campaign', r.url == null ? null : String(r.url), r.referrer == null ? null : String(r.referrer)),
  }));
}

// ── Segmentation by entryChannel / entryCampaign ──────────────────────────────
// Raw-event sourced: each visitor maps to one first-touch segment (deduped per visitor), then orders
// attribute back via attribution->>'visitorId' for order/revenue counts.

interface SegmentVisitorRow {
  key: string | null;
  visitors: number;
}
interface SegmentOrderRow {
  key: string | null;
  orders: number;
  revenueMinor: number;
  convertingVisitors: number;
}

function segmentKeyOf(touch: VisitorFirstTouch, dimension: SegmentDimension): string | null {
  return dimension === 'campaign' ? touch.campaign : touch.channel;
}

async function loadSegmentVisitors(range: DiagnosticsRange, dimension: SegmentDimension): Promise<SegmentVisitorRow[]> {
  const touches = await loadVisitorFirstTouch(range, dimension);
  const counts = new Map<string, number>();
  for (const t of touches) {
    const key = segmentKeyOf(t, dimension) ?? '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, visitors]) => ({ key: key === '' ? null : key, visitors }));
}

// Paid orders attributed to this funnel via attribution->>'funnelId', keyed back to the visitor's
// first-touch segment so orders/revenue/convertingVisitors aggregate per channel/campaign.
async function loadSegmentOrders(range: DiagnosticsRange, dimension: SegmentDimension): Promise<SegmentOrderRow[]> {
  const touches = await loadVisitorFirstTouch(range, dimension);
  const segByVisitor = new Map(touches.map((t) => [t.visitorId, segmentKeyOf(t, dimension)]));

  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to, PAID_ORDER_STATUSES];
  const sql = `
    SELECT o."attribution"->>'visitorId' AS "visitorId", o."capturedTotal" AS "capturedTotal"
    FROM "orders" o
    WHERE o."tenantId" = $1
      AND o."attribution"->>'funnelId' = $2
      AND o."createdAt" >= $3
      AND o."createdAt" <= $4
      AND o."status"::text = ANY($5)`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);

  interface Agg { orders: number; revenueMinor: number; visitors: Set<string> }
  const byKey = new Map<string, Agg>();
  for (const r of rows) {
    const visitorId = r.visitorId == null ? null : String(r.visitorId);
    if (!visitorId || !segByVisitor.has(visitorId)) continue;
    const key = segByVisitor.get(visitorId) ?? '';
    const slot = key === null ? '' : key;
    let agg = byKey.get(slot);
    if (!agg) {
      agg = { orders: 0, revenueMinor: 0, visitors: new Set() };
      byKey.set(slot, agg);
    }
    agg.orders += 1;
    agg.revenueMinor += toNumber(r.capturedTotal);
    agg.visitors.add(visitorId);
  }
  return [...byKey.entries()].map(([key, agg]) => ({
    key: key === '' ? null : key,
    orders: agg.orders,
    revenueMinor: agg.revenueMinor,
    convertingVisitors: agg.visitors.size,
  }));
}

function mergeSegments(visitors: SegmentVisitorRow[], orders: SegmentOrderRow[]): SegmentRow[] {
  const orderByKey = new Map(orders.map((o) => [o.key ?? '', o]));
  return visitors.map((v) => {
    const k = v.key ?? '';
    const o = orderByKey.get(k);
    const label = v.key && v.key.length > 0 ? v.key : 'Direct / Unknown';
    return {
      key: k || 'direct',
      label,
      visitors: v.visitors,
      orders: o?.orders ?? 0,
      revenueMinor: o?.revenueMinor ?? 0,
      convertingVisitors: o?.convertingVisitors ?? 0,
    };
  });
}

export async function loadSegments(range: DiagnosticsRange, dimension: SegmentDimension): Promise<SegmentDto[]> {
  return cached(cacheKey('segments', range, dimension), async () => {
    const [visitors, orders] = await Promise.all([
      loadSegmentVisitors(range, dimension).catch(() => [] as SegmentVisitorRow[]),
      loadSegmentOrders(range, dimension).catch(() => [] as SegmentOrderRow[]),
    ]);
    return topNWithOther(mergeSegments(visitors, orders));
  });
}

// ── Experiment-arm breakdown ──────────────────────────────────────────────────

export interface ExperimentArmRow {
  experimentId: string;
  armId: string;
  visitors: number;
  orders: number;
  revenueMinor: number;
  convertingVisitors: number;
}

interface ArmVisitorRow {
  experimentId: string | null;
  armId: string | null;
  visitors: number;
}
interface ArmOrderRow {
  experimentId: string | null;
  armId: string | null;
  orders: number;
  revenueMinor: number;
  convertingVisitors: number;
}

// Arm membership lives in ab_test_assignments (trackingId == visitorId); count distinct funnel
// visitors (entered = had a 'page_view' for the funnel in window) per experiment/arm.
async function loadArmVisitors(range: DiagnosticsRange): Promise<ArmVisitorRow[]> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to];
  const sql = `
    WITH entering AS (
      SELECT DISTINCT e."visitorId" AS "visitorId"
      FROM "user_activity_events" e
      WHERE e."tenantId" = $1
        AND e."funnelId" = $2
        AND e."kind" = 'page_view'
        AND e."occurredAt" >= $3
        AND e."occurredAt" <= $4
    )
    SELECT a."experimentId" AS "experimentId", a."armId" AS "armId",
           COUNT(DISTINCT a."trackingId")::int AS "visitors"
    FROM "ab_test_assignments" a
    JOIN entering en ON en."visitorId" = a."trackingId"
    WHERE a."tenantId" = $1
    GROUP BY a."experimentId", a."armId"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    experimentId: r.experimentId == null ? null : String(r.experimentId),
    armId: r.armId == null ? null : String(r.armId),
    visitors: toNumber(r.visitors),
  }));
}

// Paid funnel orders (attribution->>'funnelId') joined to their visitor's arm assignment so
// orders/revenue/convertingVisitors aggregate per experiment/arm.
async function loadArmOrders(range: DiagnosticsRange): Promise<ArmOrderRow[]> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to, PAID_ORDER_STATUSES];
  const sql = `
    WITH funnel_orders AS (
      SELECT o."id", o."attribution"->>'visitorId' AS "visitorId", o."capturedTotal"
      FROM "orders" o
      WHERE o."tenantId" = $1
        AND o."attribution"->>'funnelId' = $2
        AND o."createdAt" >= $3
        AND o."createdAt" <= $4
        AND o."status"::text = ANY($5)
    )
    SELECT a."experimentId" AS "experimentId", a."armId" AS "armId",
           COUNT(fo."id")::int AS "orders",
           COALESCE(SUM(fo."capturedTotal"), 0)::bigint AS "revenueMinor",
           COUNT(DISTINCT fo."visitorId")::int AS "convertingVisitors"
    FROM funnel_orders fo
    JOIN "ab_test_assignments" a
      ON a."tenantId" = $1 AND a."trackingId" = fo."visitorId"
    GROUP BY a."experimentId", a."armId"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    experimentId: r.experimentId == null ? null : String(r.experimentId),
    armId: r.armId == null ? null : String(r.armId),
    orders: toNumber(r.orders),
    revenueMinor: toNumber(r.revenueMinor),
    convertingVisitors: toNumber(r.convertingVisitors),
  }));
}

export async function loadExperimentArms(range: DiagnosticsRange): Promise<ExperimentArmRow[]> {
  return cached(cacheKey('experiments', range), async () => {
    const [visitors, orders] = await Promise.all([
      loadArmVisitors(range).catch(() => [] as ArmVisitorRow[]),
      loadArmOrders(range).catch(() => [] as ArmOrderRow[]),
    ]);
    const orderByKey = new Map(orders.map((o) => [`${o.experimentId}|${o.armId}`, o]));
    return visitors
      .filter((v) => v.experimentId && v.armId)
      .map((v) => {
        const o = orderByKey.get(`${v.experimentId}|${v.armId}`);
        return {
          experimentId: v.experimentId as string,
          armId: v.armId as string,
          visitors: v.visitors,
          orders: o?.orders ?? 0,
          revenueMinor: o?.revenueMinor ?? 0,
          convertingVisitors: o?.convertingVisitors ?? 0,
        };
      });
  });
}

// ── Checkout micro-funnel + payment health ────────────────────────────────────

export interface CheckoutMicroFunnelData {
  stages: Array<{ key: string; label: string; visitors: number }>;
  paymentErrors: number;
  providers: Array<{
    provider: string;
    attempts: number;
    successes: number;
    errors: number;
  }>;
}

interface ActivityKindRow {
  kind: string;
  visitors: number;
}
interface ProviderActionRow {
  kind: string;
  provider: string | null;
  visitors: number;
}

async function loadCheckoutStageCounts(range: DiagnosticsRange): Promise<ActivityKindRow[]> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to];
  const sql = `
    SELECT "kind" AS "kind", COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1
      AND "funnelId" = $2
      AND "occurredAt" >= $3
      AND "occurredAt" <= $4
      AND "kind" IN ('checkout_view', 'shipping_submitted', 'payment_method_selected',
                     'payment_button_click', 'payment_submit', 'payment_success', 'payment_error')
    GROUP BY "kind"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({ kind: String(r.kind), visitors: toNumber(r.visitors) }));
}

async function loadProviderActions(range: DiagnosticsRange): Promise<ProviderActionRow[]> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to];
  const sql = `
    SELECT "kind" AS "kind", "metadata"->>'provider' AS "provider",
           COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1
      AND "funnelId" = $2
      AND "occurredAt" >= $3
      AND "occurredAt" <= $4
      AND "kind" IN ('payment_button_click', 'payment_submit', 'payment_success', 'payment_error')
    GROUP BY "kind", "metadata"->>'provider'`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    kind: String(r.kind),
    provider: r.provider == null ? null : String(r.provider).toLowerCase(),
    visitors: toNumber(r.visitors),
  }));
}

export async function loadCheckoutMicroFunnel(range: DiagnosticsRange): Promise<CheckoutMicroFunnelData> {
  return cached(cacheKey('payments', range), async () => {
    const [stageRows, providerRows] = await Promise.all([
      loadCheckoutStageCounts(range).catch(() => [] as ActivityKindRow[]),
      loadProviderActions(range).catch(() => [] as ProviderActionRow[]),
    ]);
    const byKind = new Map(stageRows.map((r) => [r.kind, r.visitors]));
    const stages = CHECKOUT_STAGES.map((s) => ({ ...s, visitors: byKind.get(s.key) ?? 0 }));
    const paymentErrors = byKind.get('payment_error') ?? 0;

    const providers = PAYMENT_PROVIDERS.map((provider) => {
      const rowsFor = providerRows.filter((r) => r.provider === provider);
      const sumKinds = (kinds: string[]) =>
        rowsFor.filter((r) => kinds.includes(r.kind)).reduce((acc, r) => acc + r.visitors, 0);
      return {
        provider,
        attempts: sumKinds(['payment_button_click', 'payment_submit']),
        successes: sumKinds(['payment_success']),
        errors: sumKinds(['payment_error']),
      };
    });
    return { stages, paymentErrors, providers };
  });
}

// ── Trend + period comparison ─────────────────────────────────────────────────
// Visitors = distinct entering visitors per hour (first 'page_view' for the funnel); completed = paid
// funnel orders per hour; revenue from those orders. All grouped hourly then downsampled.

interface CompletedBucketRow {
  bucketStart: string;
  completed: number;
}
interface SessionVisitorBucketRow {
  bucketStart: string;
  visitors: number;
}
interface RevenueBucketRow {
  bucketStart: string;
  revenueMinor: number;
}

// Funnel-completion per hour: count of paid funnel orders bucketed by order createdAt (UTC), keyed with
// the same hourly bucket format as the visitor/revenue series so the three merge cleanly.
async function loadCompletedBuckets(range: DiagnosticsRange): Promise<CompletedBucketRow[]> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to, PAID_ORDER_STATUSES];
  const sql = `
    SELECT to_char(date_trunc('hour', o."createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00.000"Z"') AS "bucketStart",
           COUNT(o."id")::int AS "completed"
    FROM "orders" o
    WHERE o."tenantId" = $1
      AND o."attribution"->>'funnelId' = $2
      AND o."createdAt" >= $3
      AND o."createdAt" <= $4
      AND o."status"::text = ANY($5)
    GROUP BY 1`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    bucketStart: String(r.bucketStart),
    completed: toNumber(r.completed),
  }));
}

// Distinct entering visitors per hour of their first funnel 'page_view' occurredAt (UTC), keyed with the
// same hourly bucket format as the completed/revenue buckets so the three series merge cleanly.
async function loadSessionVisitorBuckets(range: DiagnosticsRange): Promise<SessionVisitorBucketRow[]> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to];
  const sql = `
    WITH first_touch AS (
      SELECT e."visitorId" AS "visitorId", MIN(e."occurredAt") AS "startedAt"
      FROM "user_activity_events" e
      WHERE e."tenantId" = $1
        AND e."funnelId" = $2
        AND e."kind" = 'page_view'
        AND e."occurredAt" >= $3
        AND e."occurredAt" <= $4
      GROUP BY e."visitorId"
    )
    SELECT to_char(date_trunc('hour', "startedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00.000"Z"') AS "bucketStart",
           COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM first_touch
    GROUP BY 1`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({ bucketStart: String(r.bucketStart), visitors: toNumber(r.visitors) }));
}

// Revenue per hour bucketed by order time (createdAt), scoped to the funnel via attribution->>'funnelId'
// so each paid order is summed once in its own createdAt hour.
async function loadRevenueBuckets(range: DiagnosticsRange): Promise<RevenueBucketRow[]> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to, PAID_ORDER_STATUSES];
  const sql = `
    SELECT to_char(date_trunc('hour', o."createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00.000"Z"') AS "bucketStart",
           COALESCE(SUM(o."capturedTotal"), 0)::bigint AS "revenueMinor"
    FROM "orders" o
    WHERE o."tenantId" = $1
      AND o."attribution"->>'funnelId' = $2
      AND o."createdAt" >= $3
      AND o."createdAt" <= $4
      AND o."status"::text = ANY($5)
    GROUP BY 1`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({ bucketStart: String(r.bucketStart), revenueMinor: toNumber(r.revenueMinor) }));
}

function joinTrendBuckets(
  sessionVisitors: SessionVisitorBucketRow[],
  completed: CompletedBucketRow[],
  revenue: RevenueBucketRow[],
): TrendBucketRow[] {
  const buckets = new Map<string, TrendBucketRow>();
  const at = (key: string): TrendBucketRow => {
    let row = buckets.get(key);
    if (!row) {
      row = { bucketStart: key, visitors: 0, completed: 0, revenueMinor: 0 };
      buckets.set(key, row);
    }
    return row;
  };
  for (const r of sessionVisitors) at(r.bucketStart).visitors = r.visitors;
  for (const r of completed) at(r.bucketStart).completed = r.completed;
  for (const r of revenue) at(r.bucketStart).revenueMinor = r.revenueMinor;
  return [...buckets.values()];
}

async function loadWindowTotals(range: DiagnosticsRange): Promise<PeriodTotals> {
  const [entering, totals] = await Promise.all([
    loadEnteringVisitors(range).catch(() => ({ enteringVisitors: 0, convertingVisitors: 0 })),
    loadOrderTotals(range).catch(() => ({ orders: 0, revenueMinor: 0 })),
  ]);
  return {
    visitors: entering.enteringVisitors,
    orders: totals.orders,
    revenueMinor: totals.revenueMinor,
    convertingVisitors: entering.convertingVisitors,
  };
}

// Canonical visitor model: entering = distinct visitors with a funnel 'page_view' in the window;
// converting = the entering subset whose visitorId appears in a paid funnel order. Tying converting to
// the entering set keeps CVR <= 100%.
async function loadEnteringVisitors(
  range: DiagnosticsRange,
): Promise<{ enteringVisitors: number; convertingVisitors: number }> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to, PAID_ORDER_STATUSES];
  const sql = `
    WITH entering AS (
      SELECT DISTINCT e."visitorId" AS "visitorId"
      FROM "user_activity_events" e
      WHERE e."tenantId" = $1
        AND e."funnelId" = $2
        AND e."kind" = 'page_view'
        AND e."occurredAt" >= $3
        AND e."occurredAt" <= $4
    ),
    funnel_orders AS (
      SELECT DISTINCT o."attribution"->>'visitorId' AS "visitorId"
      FROM "orders" o
      WHERE o."tenantId" = $1
        AND o."attribution"->>'funnelId' = $2
        AND o."status"::text = ANY($5)
    )
    SELECT (SELECT COUNT(*)::int FROM entering) AS "enteringVisitors",
           (SELECT COUNT(*)::int FROM entering e JOIN funnel_orders fo ON fo."visitorId" = e."visitorId") AS "convertingVisitors"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  const row = rows[0] ?? {};
  return {
    enteringVisitors: toNumber(row.enteringVisitors),
    convertingVisitors: toNumber(row.convertingVisitors),
  };
}

// Order/revenue totals scoped to the funnel via attribution->>'funnelId', windowed by order time
// (createdAt). Each paid order counted once.
async function loadOrderTotals(range: DiagnosticsRange): Promise<{ orders: number; revenueMinor: number }> {
  const params: unknown[] = [getCurrentTenantId(), range.funnelId, range.from, range.to, PAID_ORDER_STATUSES];
  const sql = `
    SELECT COUNT(o."id")::int AS "orders",
           COALESCE(SUM(o."capturedTotal"), 0)::bigint AS "revenueMinor"
    FROM "orders" o
    WHERE o."tenantId" = $1
      AND o."attribution"->>'funnelId' = $2
      AND o."createdAt" >= $3
      AND o."createdAt" <= $4
      AND o."status"::text = ANY($5)`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  const row = rows[0] ?? {};
  return {
    orders: toNumber(row.orders),
    revenueMinor: toNumber(row.revenueMinor),
  };
}

export interface TrendResult {
  granularity: 'hour' | 'day';
  points: TrendPointDto[];
  comparison: ReturnType<typeof buildPeriodComparison>;
}

export async function loadTrend(range: DiagnosticsRange): Promise<TrendResult> {
  return cached(cacheKey('trend', range), async () => {
    const prev = previousWindow(range.from, range.to);
    const prevRange: DiagnosticsRange = { funnelId: range.funnelId, from: prev.from, to: prev.to };

    const [sessionVisitors, completed, revenue, currentTotals, previousTotals] = await Promise.all([
      loadSessionVisitorBuckets(range).catch(() => [] as SessionVisitorBucketRow[]),
      loadCompletedBuckets(range).catch(() => [] as CompletedBucketRow[]),
      loadRevenueBuckets(range).catch(() => [] as RevenueBucketRow[]),
      loadWindowTotals(range),
      loadWindowTotals(prevRange),
    ]);

    const granularity = pickGranularity(range.from, range.to);
    const points = downsampleTrend(joinTrendBuckets(sessionVisitors, completed, revenue), granularity);
    const comparison = buildPeriodComparison(currentTotals, previousTotals);
    return { granularity, points, comparison };
  });
}
