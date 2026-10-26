import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { DB_TO_FUNNEL_PAGE_TYPE } from '@/components/funnel/types';
import {
  aggregateMethodStats,
  aggregateAnalyticsKpi,
  aggregateFunnelSteps,
  aggregateTrafficSources,
  conversionRate,
  deriveTrafficSource,
  RENDERABLE_STEP_DB_TYPES,
  type FunnelStepRow,
  type MethodStatsRow,
  type AnalyticsKpi,
  type TrafficSourceRow,
  type AnalyticsWindow,
} from './analytics-helpers';
import {
  queryVisitorCount,
  queryVisitorBuckets,
  queryStepVisitorCounts,
  queryCustomEventCountsByStep,
  queryVisitorSourceRows,
  queryAttributedOrders,
  queryMethodChargesByVisitor,
} from './funnel-stats-queries';
import { customEventNameOf } from '@/lib/analytics/custom-event-name';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AnalyticsDashboard');

// Upper bound on the visitor set pushed into `= ANY($n)` when filtering by traffic source. Beyond
// this the filtered panels under-report rather than issuing an unbounded array parameter.
export const SOURCE_VISITOR_LIMIT = 20000;

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

function bucketSeries(
  orders: Array<{ createdAt: Date; capturedTotal: number }>,
  window: AnalyticsWindow,
  valueOf: (o: { createdAt: Date; capturedTotal: number }) => number,
): number[] {
  const buckets = new Array<number>(window.bucketCount).fill(0);
  const startMs = window.start.getTime();
  for (const o of orders) {
    const offset = o.createdAt.getTime() - startMs;
    if (offset < 0) continue;
    const idx = Math.floor(offset / window.bucketMs);
    if (idx >= 0 && idx < window.bucketCount) buckets[idx] += valueOf(o);
  }
  return buckets;
}

function funnelRoleOf(dbType: string | null | undefined): string | null {
  if (!dbType) return null;
  return DB_TO_FUNNEL_PAGE_TYPE[dbType.toUpperCase()] ?? null;
}

// Entry source from the visitor's first page_view: utm_source / click ids live in the stored URL
// (url = location.href at capture); metadata.clickIds is a fallback for rows with a relative url.
function deriveSourceFromVisit(url: string | null, metadata: unknown): string {
  const params: Record<string, string> = {};
  if (url) {
    try {
      new URL(url).searchParams.forEach((v, k) => {
        if (v && !(k in params)) params[k] = v;
      });
    } catch {
      // relative or malformed url -> rely on metadata fallback below
    }
  }
  const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : null;
  const clickIds = meta?.clickIds && typeof meta.clickIds === 'object'
    ? (meta.clickIds as Record<string, unknown>)
    : null;
  if (clickIds) {
    for (const [k, v] of Object.entries(clickIds)) {
      if (typeof v === 'string' && v && !(k in params)) params[k] = v;
    }
  }
  return deriveTrafficSource(null, params);
}

export interface AnalyticsKpiSparks extends AnalyticsKpi {
  visitsSparkline: number[];
  ordersSparkline: number[];
  revenueSparkline: number[];
}

interface OrderKpiRow {
  createdAt: Date;
  status: string;
  capturedTotal: number;
  currencyCode: string;
}

async function loadRecentOrders(start: Date, end: Date): Promise<OrderKpiRow[]> {
  const db = getTenantPrisma();
  return safe(
    db.order.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true, status: true, capturedTotal: true, currencyCode: true },
    }) as Promise<OrderKpiRow[]>,
    [],
  );
}

export async function loadAnalyticsKpi(opts: {
  funnelId?: string | null;
  window: AnalyticsWindow;
  visitorIds?: string[] | null;
}): Promise<AnalyticsKpiSparks> {
  const funnelId = opts.funnelId ?? null;
  const visitorIds = opts.visitorIds ?? null;
  const { window } = opts;

  // No funnel selected -> count all site visits so the Visits/Conversion KPIs pair with total orders.
  const allTraffic = !funnelId;

  const orders: Array<{ createdAt: Date; status: string; capturedTotal: number }> = funnelId || visitorIds
    ? (await safe(
        queryAttributedOrders(funnelId, window.prevStart, window.end, { visitorIds, allTraffic }),
        [],
      )).map((o) => ({
        createdAt: o.createdAt,
        status: o.status,
        capturedTotal: o.capturedTotal,
      }))
    : await loadRecentOrders(window.prevStart, window.end);

  const bucketSeconds = window.bucketMs / 1000;
  const [visits24h, visitsPrev24h, visitsSparkline] = await Promise.all([
    safe(queryVisitorCount(funnelId, window.start, window.end, allTraffic, visitorIds), 0),
    safe(queryVisitorCount(funnelId, window.prevStart, window.prevEnd, allTraffic, visitorIds), 0),
    safe(
      queryVisitorBuckets(funnelId, window.start, window.bucketCount, bucketSeconds, allTraffic, visitorIds),
      new Array<number>(window.bucketCount).fill(0),
    ),
  ]);

  const base = aggregateAnalyticsKpi({
    visits: [],
    orders: orders.map((o) => ({ paidAt: o.createdAt, status: o.status, totalUSD: o.capturedTotal / 100 })),
    window: {
      start: window.start.getTime(),
      end: window.end.getTime(),
      prevStart: window.prevStart.getTime(),
      prevEnd: window.prevEnd.getTime(),
    },
  });

  const ordersSparkline = bucketSeries(orders, window, () => 1);
  const revenueSparkline = bucketSeries(orders, window, (o) => o.capturedTotal / 100);

  return {
    ...base,
    visits24h,
    visitsPrev24h,
    conversionRate24h: conversionRate(base.orders24h, visits24h),
    conversionRatePrev24h: conversionRate(base.ordersPrev24h, visitsPrev24h),
    visitsSparkline,
    ordersSparkline,
    revenueSparkline,
  };
}

export async function loadFunnelSteps(opts: {
  funnelId?: string | null;
  window: AnalyticsWindow;
  visitorIds?: string[] | null;
}): Promise<FunnelStepRow[]> {
  const { window } = opts;
  const [counts, customRows] = await Promise.all([
    safe(queryStepVisitorCounts(opts.funnelId ?? null, window.start, window.end, opts.visitorIds ?? null), []),
    safe(
      queryCustomEventCountsByStep(
        opts.funnelId ?? null,
        window.start,
        window.end,
        opts.visitorIds ?? null,
        RENDERABLE_STEP_DB_TYPES,
      ),
      [],
    ),
  ]);

  const visits: Array<{ pageType: string }> = [];
  for (const c of counts) {
    const role = funnelRoleOf(c.stepId);
    if (!role) continue;
    for (let i = 0; i < c.visitors; i++) visits.push({ pageType: role });
  }

  const customEvents = customRows.flatMap((r) => {
    const role = funnelRoleOf(r.stepId);
    const name = customEventNameOf(r.kind);
    return role && name ? [{ pageType: role, name, visitors: r.visitors }] : [];
  });

  return aggregateFunnelSteps({ visits, customEvents }, { dropEmpty: true });
}

export async function loadMethodStats(opts: {
  funnelId?: string | null;
  window: AnalyticsWindow;
  visitorIds?: string[] | null;
}): Promise<MethodStatsRow[]> {
  const { window } = opts;
  const visitorIds = opts.visitorIds ?? null;
  const db = getTenantPrisma();

  const charges = visitorIds
    ? await safe(queryMethodChargesByVisitor(window.start, window.end, visitorIds), [])
    : await safe(
        db.transaction.findMany({
          where: { type: 'CHARGE', createdAt: { gte: window.start, lt: window.end } },
          select: { provider: true, status: true, amountMinor: true },
        }) as Promise<Array<{ provider: string; status: string; amountMinor: number }>>,
        [],
      );

  return aggregateMethodStats({
    orders: charges.map((c) => ({
      paymentMethod: c.provider,
      status: c.status === 'SUCCEEDED' || c.status === 'CAPTURED' ? 'PAID' : c.status,
      totalUSD: c.amountMinor / 100,
    })),
  });
}

export async function loadTrafficSources(opts: {
  funnelId?: string | null;
  window: AnalyticsWindow;
}): Promise<TrafficSourceRow[]> {
  const funnelId = opts.funnelId ?? null;
  const { window } = opts;

  const [sourceRows, orders] = await Promise.all([
    safe(queryVisitorSourceRows(funnelId, window.start, window.end), []),
    safe(queryAttributedOrders(funnelId, window.start, window.end), []),
  ]);

  // sourceRows are ordered occurredAt ASC, so the first row per visitor is their entry source.
  const sourceByVisitor = new Map<string, string>();
  for (const r of sourceRows) {
    if (sourceByVisitor.has(r.visitorId)) continue;
    sourceByVisitor.set(r.visitorId, deriveSourceFromVisit(r.url, r.metadata));
  }

  const visits = Array.from(sourceByVisitor.values()).map((src) => ({ trafficSource: src, urlParams: null }));
  const orderInputs = orders.map((o) => ({
    trafficSource: o.visitorId ? sourceByVisitor.get(o.visitorId) ?? 'UNKNOWN' : 'UNKNOWN',
    totalUSD: o.capturedTotal / 100,
    status: o.status,
  }));

  return aggregateTrafficSources({ visits, orders: orderInputs });
}

// Resolves the visitors whose entry page_view maps to `source`, over [start, end). Derivation reuses
// deriveSourceFromVisit so the filter and the Traffic sources table agree on what a source is. The
// window is deliberately the widest one a caller needs (KPIs include the previous period) so every
// panel filters against one consistent entry-source assignment per visitor.
export async function loadSourceVisitorIds(opts: {
  funnelId?: string | null;
  source: string;
  start: Date;
  end: Date;
}): Promise<string[]> {
  const funnelId = opts.funnelId ?? null;
  const rows = await safe(
    queryVisitorSourceRows(funnelId, opts.start, opts.end, !funnelId),
    [],
  );

  const ids: string[] = [];
  for (const r of rows) {
    if (deriveSourceFromVisit(r.url, r.metadata) !== opts.source) continue;
    ids.push(r.visitorId);
    if (ids.length >= SOURCE_VISITOR_LIMIT) {
      logger.warn('traffic source filter truncated; panels under-report', {
        source: opts.source,
        funnelId,
        limit: SOURCE_VISITOR_LIMIT,
      });
      break;
    }
  }
  return ids;
}

export interface FunnelOption {
  id: string;
  name: string;
}

export async function loadFunnelOptions(): Promise<FunnelOption[]> {
  const db = getTenantPrisma();
  const rows = await safe(
    db.funnel.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }) as Promise<Array<{ id: string; name: string }>>,
    [],
  );
  return rows;
}
