import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { bucketByHour, computeDelta, type DeltaResult, type AggregateInput } from './overview-helpers';
import { loadSystemActivity, type ActivityEntry } from './system-activity';
import {
  queryVisitorCount,
  queryVisitorSparkline,
  queryVisitorCountsByFunnel,
  queryAttributedOrders,
  queryLatestTrafficAt,
} from './funnel-stats-queries';
import { conversionRate } from './analytics-helpers';
import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import {
  getLastConversionAnalysisResult,
  type LastConversionAnalysisResult,
} from '@/lib/config/keys';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

export type { ActivityEntry };

export interface KeyMetric {
  label: string;
  value: string;
  delta: { value: string; direction: 'up' | 'down'; tone: 'ok' | 'bad' | 'muted' };
  sparkline: number[];
}

export interface FunnelRow {
  id: string;
  name: string;
  runtime: 'Edge' | 'Local';
  visits24h: number;
  orders24h: number;
  conv: string;
  needsRetry: boolean;
  updatedAt: Date;
}

export interface OverviewData {
  metrics: {
    orders: KeyMetric;
    conversion: KeyMetric;
    revenue: KeyMetric;
  };
  funnels: {
    rows: FunnelRow[];
    totalCount: number;
    runningCount: number;
    lastSyncSec: number;
  };
  activity: ActivityEntry[];
  integrationsRaw: AggregateInput;
  recallRecovered: {
    count: number;
    revenue: string;
    sparkline: number[];
  };
  lastAnalysis: LastConversionAnalysisResult | null;
}

interface OrderKpiRow {
  createdAt: Date;
  status: string;
  capturedTotal: number;
}

async function loadAdConnections(): Promise<AggregateInput['adPlatforms']> {
  try {
    const deps = await createAdsDepsForRequest();
    const ads = await makeAcquisitionAds(deps);
    const connections = await ads.connectionRepo.list();
    return connections.map((c) => ({
      id: c.id,
      name: c.externalAccountId,
      platform: c.platform,
      isActive: c.status === 'ACTIVE',
      credentials: {},
    }));
  } catch {
    return [];
  }
}

export async function loadOverviewData(now: Date = new Date()): Promise<OverviewData> {
  const start24 = new Date(now.getTime() - DAY_MS);
  const start48 = new Date(now.getTime() - 2 * DAY_MS);
  const start7d = new Date(now.getTime() - 7 * DAY_MS);
  const db = getTenantPrisma();

  const [
    orders48,
    funnels,
    adPlatforms,
    paymentConfigs,
    emailConfigs,
    activity,
    visits24,
    visitsPrev24,
    conversionSpark,
    funnelVisits,
    attributedOrders24,
    latestTrafficAt,
  ] = await Promise.all([
    safe(
      db.order.findMany({
        where: { createdAt: { gte: start48 } },
        select: { createdAt: true, status: true, capturedTotal: true },
      }) as Promise<OrderKpiRow[]>,
      [],
    ),
    safe(
      db.funnel.findMany({
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, updatedAt: true },
      }) as Promise<Array<{ id: string; name: string; updatedAt: Date }>>,
      [],
    ),
    loadAdConnections(),
    safe(
      (async () => {
        const { listPaymentProviders, getPaymentProviderEntryWithCredentials } =
          await import('@/lib/config/payment');
        const metas = await listPaymentProviders();
        return Promise.all(
          metas.map(async (m) => {
            const withCreds = await getPaymentProviderEntryWithCredentials(m.provider);
            return { id: m.id, name: m.name, provider: m.provider, isActive: m.isActive, credentials: withCreds?.credentials ?? null };
          }),
        );
      })() as Promise<AggregateInput['paymentConfigs']>,
      [] as AggregateInput['paymentConfigs'],
    ),
    safe(
      (async () => {
        const { getEmailKvConfigWithCredentials } = await import('@/lib/config/email');
        const cfg = await getEmailKvConfigWithCredentials();
        return cfg
          ? [{ id: cfg.id, name: cfg.name, provider: cfg.provider, fromEmail: cfg.fromEmail, isActive: cfg.isActive, credentials: cfg.credentials }]
          : [];
      })() as Promise<AggregateInput['emailConfigs']>,
      [] as AggregateInput['emailConfigs'],
    ),
    safe(loadSystemActivity(now, 5), [] as ActivityEntry[]),
    safe(queryVisitorCount(null, start24, now, true), 0),
    safe(queryVisitorCount(null, start48, start24, true), 0),
    safe(queryVisitorSparkline(null, now, 24, true), new Array<number>(24).fill(0)),
    safe(queryVisitorCountsByFunnel(start24, now), []),
    safe(queryAttributedOrders(null, start24), []),
    safe(queryLatestTrafficAt(), null),
  ]);

  const lastAnalysis = await getLastConversionAnalysisResult().catch(() => undefined);

  const recallRecovered = await loadRecallRecovered(db, start7d, now);

  const orders24 = orders48.filter((o) => o.createdAt.getTime() >= start24.getTime());
  const ordersPrev24 = orders48.filter((o) => o.createdAt.getTime() < start24.getTime());
  const orders24Count = orders24.length;
  const ordersPrev24Count = ordersPrev24.length;
  const paid = (rows: OrderKpiRow[]) => rows.filter((o) => o.status === 'PAID');
  const revenue24 = paid(orders24).reduce((sum, o) => sum + o.capturedTotal, 0) / 100;
  const revenuePrev24 = paid(ordersPrev24).reduce((sum, o) => sum + o.capturedTotal, 0) / 100;

  const ordersSpark = bucketByHour(orders24.map((o) => ({ createdAt: o.createdAt })), now, 24);
  const revenueSpark = new Array<number>(24).fill(0);
  const startMs = now.getTime() - DAY_MS;
  for (const o of paid(orders24)) {
    const idx = Math.min(23, Math.max(0, Math.floor((o.createdAt.getTime() - startMs) / HOUR_MS)));
    revenueSpark[idx] += o.capturedTotal / 100;
  }

  const orderDelta = toMetricDelta(computeDelta(orders24Count, ordersPrev24Count));
  const revDelta = toMetricDelta(computeDelta(revenue24, revenuePrev24));

  const conv24 = conversionRate(orders24Count, visits24);
  const convPrev24 = conversionRate(ordersPrev24Count, visitsPrev24);
  const convDelta = toMetricDelta(computeDelta(conv24, convPrev24));

  const metrics = {
    orders: { label: 'Total orders (24h)', value: formatInt(orders24Count), delta: orderDelta, sparkline: ordersSpark },
    conversion: { label: 'Conversion rate (24h)', value: `${conv24.toFixed(2)}%`, delta: convDelta, sparkline: conversionSpark },
    revenue: { label: 'Revenue (24h)', value: formatMoney(revenue24), delta: revDelta, sparkline: revenueSpark },
  };

  const visitsByFunnel = new Map(funnelVisits.map((r) => [r.funnelId, r.visitors]));
  const ordersByFunnel = new Map<string, number>();
  for (const o of attributedOrders24) {
    if (!o.funnelId) continue;
    ordersByFunnel.set(o.funnelId, (ordersByFunnel.get(o.funnelId) ?? 0) + 1);
  }

  const topFunnels: FunnelRow[] = funnels.slice(0, 6).map((f) => {
    const v = visitsByFunnel.get(f.id) ?? 0;
    const o = ordersByFunnel.get(f.id) ?? 0;
    return {
      id: f.id,
      name: f.name,
      runtime: 'Edge',
      visits24h: v,
      orders24h: o,
      conv: `${conversionRate(o, v).toFixed(2)}%`,
      needsRetry: false,
      updatedAt: f.updatedAt,
    };
  });

  const lastEditMs = funnels.reduce((min, f) => Math.min(min, now.getTime() - f.updatedAt.getTime()), Infinity);
  const lastTrafficMs = latestTrafficAt ? now.getTime() - latestTrafficAt.getTime() : Infinity;
  const lastSyncMs = Math.min(lastEditMs, lastTrafficMs);
  const lastSyncSec = isFinite(lastSyncMs) ? Math.max(0, Math.floor(lastSyncMs / 1000)) : 0;

  return {
    metrics,
    funnels: { rows: topFunnels, totalCount: funnels.length, runningCount: funnels.length, lastSyncSec },
    activity,
    integrationsRaw: { adPlatforms, paymentConfigs, emailConfigs, sites: [] },
    recallRecovered,
    lastAnalysis: lastAnalysis ?? null,
  };
}

interface RecoveredAttemptRow {
  checkoutRef: string;
  updatedAt: Date;
}

async function loadRecallRecovered(
  db: ReturnType<typeof getTenantPrisma>,
  start7d: Date,
  now: Date,
): Promise<OverviewData['recallRecovered']> {
  const recovered = await safe(
    db.recallAttempt.findMany({
      where: { status: 'recovered', updatedAt: { gte: start7d } },
      select: { checkoutRef: true, updatedAt: true },
    }) as Promise<RecoveredAttemptRow[]>,
    [],
  );

  if (recovered.length === 0) {
    return { count: 0, revenue: formatMoney(0), sparkline: new Array<number>(24 * 7).fill(0) };
  }

  const refs = Array.from(new Set(recovered.map((r) => r.checkoutRef)));
  const orders = await safe(
    db.order.findMany({
      where: { saleRef: { in: refs } },
      select: { saleRef: true, capturedTotal: true },
    }) as Promise<Array<{ saleRef: string; capturedTotal: number }>>,
    [],
  );
  const revenueBySale = new Map(orders.map((o) => [o.saleRef, o.capturedTotal]));
  const revenue = recovered.reduce((sum, r) => sum + (revenueBySale.get(r.checkoutRef) ?? 0), 0) / 100;

  const sparkline = bucketByHour(recovered.map((r) => ({ createdAt: r.updatedAt })), now, 24 * 7);

  return { count: recovered.length, revenue: formatMoney(revenue), sparkline };
}

function toMetricDelta(d: DeltaResult) {
  return { value: d.value, direction: d.direction, tone: d.tone };
}

function formatInt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatMoney(n: number): string {
  const fixed = (Math.abs(n) >= 1000 ? Math.round(n).toString() : n.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${fixed}`;
}
