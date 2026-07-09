import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { loadStatsData } from '@/composition/analytics/make-stats';
import { buildFunnel } from '@/lib/stats/funnel-aggregate';
import { toPublicFunnelUrl } from '@/lib/dashboard/funnels-helpers';
import {
  isBrowserRenderingConfigured,
  fetchScreenshot,
} from '@/lib/services/page-import/cf-browser-rendering';
import type {
  AnalystToolsDeps,
  AnalystFunnelListItem,
  AnalystFunnelMetrics,
  AnalystOrdersResult,
  AnalystOrdersArgs,
  AnalystScreenshotArgs,
  AnalystPageContent,
} from '@/lib/ai/analyst-tools';

// The analyst investigates recent funnel health; a fixed trailing window keeps the
// tool reads aligned regardless of the cron's variable run cadence.
const ANALYST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PAID_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'SHIPPED', 'DELIVERED']);
const REFUND_STATUSES = new Set(['PARTIALLY_REFUNDED', 'REFUNDED']);
const MAX_PUCK_COMPONENTS = 200;
const MAX_GRAPES_HTML = 20_000;

interface FunnelStepJson {
  stepSlug?: string;
  pageId?: string;
}

interface OrderRow {
  orderNumber: string;
  status: string;
  capturedTotal: number;
  currencyCode: string;
  createdAt: Date;
}

interface AnalystPrisma {
  order: { findMany(args: unknown): Promise<OrderRow[]> };
  funnel: { findUnique(args: unknown): Promise<{ steps: unknown } | null> };
  page: {
    findUnique(args: unknown): Promise<{
      editorType: string;
      draftData: unknown;
      publishedData: unknown;
      htmlContent: string | null;
      draftHtml: string | null;
    } | null>;
    findMany(args: unknown): Promise<Array<{ id: string; type: string }>>;
  };
  domain: { findFirst(args: unknown): Promise<{ host: string } | null> };
}

function windowKeys(now: Date): { fromBucketKey: string; toBucketKey: string } {
  return {
    fromBucketKey: new Date(now.getTime() - ANALYST_WINDOW_MS).toISOString(),
    toBucketKey: now.toISOString(),
  };
}

async function listFunnels(): Promise<AnalystFunnelListItem[]> {
  const items = await loadStatsData(windowKeys(new Date()));
  return items.map((item) => {
    const agg = buildFunnel(item.stats);
    const sessions = agg.visitors;
    const conversions = agg.orders;
    return {
      funnelId: item.funnelId,
      name: item.funnelName,
      sessions,
      conversions,
      conversionRate: sessions > 0 ? conversions / sessions : 0,
    };
  });
}

async function funnelMetrics(funnelId: string): Promise<AnalystFunnelMetrics | null> {
  const items = await loadStatsData({ funnelId, ...windowKeys(new Date()) });
  const item = items.find((i) => i.funnelId === funnelId);
  if (!item) return null;
  const agg = buildFunnel(item.stats);
  return {
    funnelId,
    stages: agg.stages.map((s) => ({
      key: s.key,
      label: s.label,
      value: s.value,
      conversionPct: s.conversionPct,
      dropPct: s.dropPct,
    })),
    upsells: agg.upsells.map((u) => ({ key: u.key, label: u.label, value: u.value, ofOrdersPct: u.ofOrdersPct })),
    revenue: agg.revenue,
    orders: agg.orders,
    visitors: agg.visitors,
    overallCvr: agg.overallCvr,
    aov: agg.aov,
  };
}

async function queryOrders(args: AnalystOrdersArgs): Promise<AnalystOrdersResult> {
  const db = getTenantPrisma() as unknown as AnalystPrisma;
  const since = new Date(Date.now() - ANALYST_WINDOW_MS);
  const where: Record<string, unknown> = { createdAt: { gte: since } };
  if (args.status) where.status = args.status.toUpperCase();

  const orders = await db.order
    .findMany({
      where,
      select: { orderNumber: true, status: true, capturedTotal: true, currencyCode: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    .catch(() => [] as OrderRow[]);

  const statusBreakdown: Record<string, number> = {};
  let paidOrders = 0;
  let revenueMinor = 0;
  let refunds = 0;
  let currencyCode = 'USD';
  for (const o of orders) {
    statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1;
    if (PAID_STATUSES.has(o.status)) {
      paidOrders += 1;
      revenueMinor += o.capturedTotal;
      currencyCode = o.currencyCode || currencyCode;
    }
    if (REFUND_STATUSES.has(o.status)) refunds += 1;
  }
  const revenue = revenueMinor / 100;
  const limit = args.limit ?? 10;

  return {
    statusBreakdown,
    paidOrders,
    ordersCount: orders.length,
    revenue,
    aov: paidOrders > 0 ? revenue / paidOrders : null,
    refunds,
    sample: orders.slice(0, limit).map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      amount: o.capturedTotal / 100,
      currencyCode: o.currencyCode || currencyCode,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

async function primaryHost(db: AnalystPrisma): Promise<string | null> {
  const domain = await db.domain
    .findFirst({ orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], select: { host: true } })
    .catch(() => null);
  return domain?.host ?? null;
}

async function resolvePageScreenshotUrl(args: AnalystScreenshotArgs): Promise<string | null> {
  const db = getTenantPrisma() as unknown as AnalystPrisma;

  if (args.pageId) {
    // pageId → its owning funnel + step slug.
    const funnels = makeFunnelDashboard();
    const all = await funnels.funnels.list().catch(() => []);
    for (const f of all) {
      const funnel = await db.funnel.findUnique({ where: { id: f.id }, select: { steps: true } }).catch(() => null);
      const steps = Array.isArray(funnel?.steps) ? (funnel!.steps as FunnelStepJson[]) : [];
      const step = steps.find((s) => s.pageId === args.pageId);
      if (step?.stepSlug) {
        const host = await primaryHost(db);
        const path = `/n/${f.id}/${step.stepSlug}`;
        return toPublicFunnelUrl(path, host) ?? null;
      }
    }
    return null;
  }

  if (args.funnelId) {
    const funnel = await db.funnel
      .findUnique({ where: { id: args.funnelId }, select: { steps: true } })
      .catch(() => null);
    const steps = Array.isArray(funnel?.steps) ? (funnel!.steps as FunnelStepJson[]) : [];
    if (steps.length === 0) return null;
    const stepSlug = args.step ?? steps[0]?.stepSlug;
    if (!stepSlug) return null;
    const host = await primaryHost(db);
    const path = `/n/${args.funnelId}/${stepSlug}`;
    return toPublicFunnelUrl(path, host) ?? null;
  }

  return null;
}

function puckComponents(data: unknown): Array<{ type: string; text?: string }> {
  if (!data || typeof data !== 'object') return [];
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return [];
  const out: Array<{ type: string; text?: string }> = [];
  for (const comp of content) {
    if (!comp || typeof comp !== 'object') continue;
    const type = (comp as { type?: unknown }).type;
    if (typeof type !== 'string') continue;
    out.push({ type, text: firstText((comp as { props?: unknown }).props) });
    if (out.length >= MAX_PUCK_COMPONENTS) break;
  }
  return out;
}

function firstText(props: unknown): string | undefined {
  if (!props || typeof props !== 'object') return undefined;
  for (const value of Object.values(props as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 200);
    if (value && typeof value === 'object' && typeof (value as { text?: unknown }).text === 'string') {
      const t = (value as { text: string }).text.trim();
      if (t) return t.slice(0, 200);
    }
  }
  return undefined;
}

async function getPageContent(pageId: string): Promise<AnalystPageContent | null> {
  const db = getTenantPrisma() as unknown as AnalystPrisma;
  const page = await db.page
    .findUnique({
      where: { id: pageId },
      select: { editorType: true, draftData: true, publishedData: true, htmlContent: true, draftHtml: true },
    })
    .catch(() => null);
  if (!page) return null;

  const editorType = page.editorType || 'PUCK';
  if (editorType.toUpperCase() === 'GRAPESJS') {
    const html = (page.htmlContent ?? page.draftHtml ?? '').trim();
    return { editorType, html: html.slice(0, MAX_GRAPES_HTML) };
  }
  return { editorType, components: puckComponents(page.publishedData ?? page.draftData) };
}

export async function buildAnalystDeps(): Promise<AnalystToolsDeps> {
  const canScreenshot = await isBrowserRenderingConfigured();
  return {
    listFunnels,
    funnelMetrics,
    queryOrders,
    resolvePageScreenshotUrl,
    getPageContent,
    screenshot: canScreenshot ? (url: string) => fetchScreenshot(url) : undefined,
  };
}
