import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { computeDelta, bucketByHour, formatCurrency, formatNumber, formatPercent, type DeltaResult } from './overview-helpers';
import {
  aggregateFunnelList,
  buildFunnelViewUrl,
  buildStepDiagramFromCounts,
  eventTypesForPageType,
  formatActivityEntry,
  funnelRoleOf,
  stepsToPages,
  toPublicFunnelUrl,
  type FunnelListRow,
  type FunnelStepDiagram,
  type FunnelStepJson,
  type ActivityLine,
  type RawActivityRow,
} from './funnels-helpers';
import {
  queryStepVisitorCounts,
  queryVisitorCount,
  queryVisitorCountsByFunnel,
  queryVisitorSparkline,
  queryAttributedOrders,
} from './funnel-stats-queries';

const DAY_MS = 24 * 60 * 60 * 1000;

function sumMinor(rows: Array<{ capturedTotal: number }>): number {
  return rows.reduce((acc, r) => acc + r.capturedTotal, 0);
}

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

function stepsOf(raw: unknown): FunnelStepJson[] {
  return Array.isArray(raw) ? (raw as FunnelStepJson[]) : [];
}

export interface FunnelsListData {
  rows: FunnelListRow[];
  totals: {
    activeFunnels: number;
    visits24h: number;
    convPct: number;
    convPctPrev: number;
  };
  visits24hSpark: number[];
  conv24hSpark: number[];
}

export async function loadFunnelsListData(now: Date = new Date()): Promise<FunnelsListData> {
  const db = getTenantPrisma();
  const funnels = await safe(
    db.funnel.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, steps: true },
    }) as Promise<Array<{ id: string; name: string; steps: unknown }>>,
    [],
  );

  const stepsByFunnel = new Map(funnels.map((f) => [f.id, stepsOf(f.steps)]));

  const primaryDomain = await safe(
    db.domain.findFirst({
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { host: true },
    }) as Promise<{ host: string } | null>,
    null,
  );
  const primaryHost = primaryDomain?.host ?? null;

  const allPageIds = Array.from(
    new Set(
      Array.from(stepsByFunnel.values()).flatMap((steps) =>
        steps.map((s) => s.pageId).filter((id): id is string => Boolean(id)),
      ),
    ),
  );
  const pageRows = allPageIds.length === 0
    ? []
    : await safe(
        db.page.findMany({ where: { id: { in: allPageIds } }, select: { id: true, slug: true, type: true } }) as Promise<Array<{ id: string; slug: string; type: string }>>,
        [],
      );
  const slugById = new Map<string, string>();
  const roleById = new Map<string, string>();
  for (const r of pageRows) {
    slugById.set(r.id, r.slug);
    roleById.set(r.id, funnelRoleOf(r.type) ?? 'LANDING');
  }

  const pagesByFunnel = new Map(
    funnels.map((f) => [f.id, stepsToPages(stepsByFunnel.get(f.id) ?? [], roleById)]),
  );

  const publicUrlByFunnel = new Map<string, string | null>();
  for (const [funnelId, pages] of pagesByFunnel) {
    const viewUrl = buildFunnelViewUrl({
      funnelId,
      primaryHost,
      pages: pages.map((p) => ({
        pageType: p.pageType,
        order: p.order,
        subOrder: p.subOrder,
        stepSlug: p.stepSlug,
        pageSlug: slugById.get(p.pageId) ?? null,
      })),
    });
    publicUrlByFunnel.set(funnelId, toPublicFunnelUrl(viewUrl, primaryHost));
  }

  const windowStart = new Date(now.getTime() - DAY_MS);
  const [visitorRows, orders24, visitsSpark] = await Promise.all([
    safe(queryVisitorCountsByFunnel(windowStart, now), []),
    safe(queryAttributedOrders(null, windowStart), []),
    safe(queryVisitorSparkline(null, now, 24), new Array<number>(24).fill(0)),
  ]);
  const visitsByFunnel = new Map(visitorRows.map((r) => [r.funnelId, r.visitors]));
  const ordersByFunnel = new Map<string, number>();
  for (const o of orders24) {
    if (!o.funnelId) continue;
    ordersByFunnel.set(o.funnelId, (ordersByFunnel.get(o.funnelId) ?? 0) + 1);
  }

  const rows = aggregateFunnelList({
    funnels: funnels.map((f) => ({
      id: f.id,
      name: f.name,
      pages: (pagesByFunnel.get(f.id) ?? []).map((p) => ({ pageType: p.pageType })),
    })),
    visits24h: [],
    orders24h: [],
    visits7d: [],
    needsRetry: new Set<string>(),
    now,
  }).map((row) => {
    const visits = visitsByFunnel.get(row.id) ?? 0;
    const orders = ordersByFunnel.get(row.id) ?? 0;
    const convPct = visits === 0 ? 0 : (orders / visits) * 100;
    return {
      ...row,
      visits24h: visits,
      orders24h: orders,
      convPct,
      conv: `${convPct.toFixed(2)}%`,
      publicUrl: publicUrlByFunnel.get(row.id) ?? null,
    };
  });

  const totalVisits = Array.from(visitsByFunnel.values()).reduce((a, b) => a + b, 0);
  const totalOrders = Array.from(ordersByFunnel.values()).reduce((a, b) => a + b, 0);
  const convPct = totalVisits === 0 ? 0 : (totalOrders / totalVisits) * 100;

  return {
    rows,
    totals: { activeFunnels: funnels.length, visits24h: totalVisits, convPct, convPctPrev: 0 },
    visits24hSpark: visitsSpark,
    conv24hSpark: new Array<number>(24).fill(0),
  };
}

export interface FunnelDetailOverviewData {
  funnel: { id: string; name: string; description: string | null };
  firstSiteUrl: string | null;
  viewUrl: string | null;
  metrics: {
    visits: { value: string; delta: { value: string; direction: 'up' | 'down'; tone: 'ok' | 'bad' | 'muted' }; sparkline: number[] };
    conversion: { value: string; delta: { value: string; direction: 'up' | 'down'; tone: 'ok' | 'bad' | 'muted' }; sparkline: number[] };
    revenue: { value: string; delta: { value: string; direction: 'up' | 'down'; tone: 'ok' | 'bad' | 'muted' }; sparkline: number[] };
  };
  diagram: FunnelStepDiagram;
  activity: Array<{ ts: Date; text: string; tone: 'ok' | 'bad' | 'muted' | 'highlight'; payload: string }>;
}

function toMetricDelta(d: DeltaResult) {
  return { value: d.value, direction: d.direction, tone: d.tone };
}

async function resolveViewUrl(
  funnelId: string,
  pages: Array<{ pageType: string; order: number; subOrder: number; stepSlug: string | null; pageId: string }>,
): Promise<{ viewUrl: string | null; firstSiteUrl: string | null }> {
  const db = getTenantPrisma();
  const primaryDomain = await safe(
    db.domain.findFirst({
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { host: true },
    }) as Promise<{ host: string } | null>,
    null,
  );

  const pageIds = pages.map((p) => p.pageId).filter(Boolean);
  const slugRows = pageIds.length === 0
    ? []
    : await safe(
        db.page.findMany({ where: { id: { in: pageIds } }, select: { id: true, slug: true, type: true } }) as Promise<Array<{ id: string; slug: string; type: string }>>,
        [],
      );
  const slugById = new Map<string, string>();
  const roleById = new Map<string, string>();
  for (const r of slugRows) {
    slugById.set(r.id, r.slug);
    roleById.set(r.id, funnelRoleOf(r.type) ?? 'LANDING');
  }

  const primaryHost = primaryDomain?.host ?? null;
  const viewUrl = buildFunnelViewUrl({
    funnelId,
    primaryHost,
    pages: pages.map((p) => ({
      pageType: roleById.get(p.pageId) ?? 'LANDING',
      order: p.order,
      subOrder: p.subOrder,
      stepSlug: p.stepSlug,
      pageSlug: slugById.get(p.pageId) ?? null,
    })),
  });
  return { viewUrl, firstSiteUrl: primaryHost ? `https://${primaryHost}` : null };
}

// Funnel-role page types for the funnel's steps, resolved from each page's stored Page.type.
async function resolveStepRoles(pageIds: string[]): Promise<string[]> {
  if (pageIds.length === 0) return [];
  const rows = await safe(
    getTenantPrisma().page.findMany({
      where: { id: { in: pageIds } },
      select: { id: true, type: true },
    }) as Promise<Array<{ id: string; type: string }>>,
    [],
  );
  const roleById = new Map<string, string>();
  for (const r of rows) {
    const role = funnelRoleOf(r.type);
    if (role) roleById.set(r.id, role);
  }
  return pageIds.map((id) => roleById.get(id)).filter((r): r is string => Boolean(r));
}

async function loadRecentActivity(funnelId: string, take: number): Promise<ActivityLine[]> {
  const rows = await safe(
    getBasePrisma().userActivityEvent.findMany({
      where: { tenantId: getCurrentTenantId(), funnelId },
      orderBy: { occurredAt: 'desc' },
      take,
      select: { kind: true, stepId: true, pageId: true, url: true, metadata: true, occurredAt: true },
    }) as Promise<RawActivityRow[]>,
    [],
  );

  const pageIds = Array.from(new Set(rows.map((r) => r.pageId).filter((id): id is string => Boolean(id))));
  const slugById = new Map<string, string>();
  if (pageIds.length > 0) {
    const slugRows = await safe(
      getTenantPrisma().page.findMany({ where: { id: { in: pageIds } }, select: { id: true, slug: true } }) as Promise<Array<{ id: string; slug: string }>>,
      [],
    );
    for (const s of slugRows) slugById.set(s.id, s.slug);
  }

  return rows.map((r) =>
    formatActivityEntry({
      ...r,
      pageSlug: r.pageId ? slugById.get(r.pageId) ?? null : null,
      occurredAt: new Date(r.occurredAt),
    }),
  );
}

export async function loadFunnelOverviewData(funnelId: string, now: Date = new Date()): Promise<FunnelDetailOverviewData | null> {
  const funnel = await safe(
    getTenantPrisma().funnel.findFirst({
      where: { id: funnelId },
      select: { id: true, name: true, description: true, steps: true },
    }) as Promise<{ id: string; name: string; description: string | null; steps: unknown } | null>,
    null,
  );
  if (!funnel) return null;

  const steps = stepsOf(funnel.steps);
  const pages = stepsToPages(steps);
  const pageIds = steps.map((s) => s.pageId).filter((id): id is string => Boolean(id));

  const windowStart = new Date(now.getTime() - DAY_MS);
  const prevStart = new Date(now.getTime() - 2 * DAY_MS);

  const [{ viewUrl, firstSiteUrl }, stepRoles, stepCounts, visitsCurrent, visitsPrev, visitsSpark, orders48] =
    await Promise.all([
      resolveViewUrl(funnel.id, pages),
      resolveStepRoles(pageIds),
      safe(queryStepVisitorCounts(funnel.id, windowStart, now), []),
      safe(queryVisitorCount(funnel.id, windowStart, now), 0),
      safe(queryVisitorCount(funnel.id, prevStart, windowStart), 0),
      safe(queryVisitorSparkline(funnel.id, now, 24), new Array<number>(24).fill(0)),
      safe(queryAttributedOrders(funnel.id, prevStart), []),
    ]);

  const countsByRole: Record<string, number> = {};
  for (const row of stepCounts) {
    const role = funnelRoleOf(row.stepId);
    if (!role) continue;
    countsByRole[role] = (countsByRole[role] ?? 0) + row.visitors;
  }
  const diagram = buildStepDiagramFromCounts(stepRoles, countsByRole);

  const ordersCurrent = orders48.filter((o) => o.createdAt.getTime() >= windowStart.getTime());
  const ordersPrev = orders48.filter((o) => o.createdAt.getTime() < windowStart.getTime());
  const revenueCurrent = sumMinor(ordersCurrent) / 100;
  const revenuePrev = sumMinor(ordersPrev) / 100;
  const convCurrent = visitsCurrent === 0 ? 0 : (ordersCurrent.length / visitsCurrent) * 100;
  const convPrev = visitsPrev === 0 ? 0 : (ordersPrev.length / visitsPrev) * 100;

  const revenueSpark = new Array<number>(24).fill(0);
  const sparkStart = now.getTime() - DAY_MS;
  for (const o of ordersCurrent) {
    const idx = Math.min(23, Math.max(0, Math.floor((o.createdAt.getTime() - sparkStart) / (60 * 60 * 1000))));
    revenueSpark[idx] += o.capturedTotal / 100;
  }
  const ordersSpark = bucketByHour(ordersCurrent.map((o) => ({ createdAt: o.createdAt })), now, 24);

  const activity = await loadRecentActivity(funnel.id, 40);

  return {
    funnel: { id: funnel.id, name: funnel.name, description: funnel.description },
    firstSiteUrl,
    viewUrl,
    metrics: {
      visits: {
        value: formatNumber(visitsCurrent),
        delta: toMetricDelta(computeDelta(visitsCurrent, visitsPrev)),
        sparkline: visitsSpark,
      },
      conversion: {
        value: formatPercent(ordersCurrent.length, visitsCurrent),
        delta: toMetricDelta(computeDelta(convCurrent, convPrev)),
        sparkline: ordersSpark,
      },
      revenue: {
        value: formatCurrency(revenueCurrent),
        delta: toMetricDelta(computeDelta(revenueCurrent, revenuePrev)),
        sparkline: revenueSpark,
      },
    },
    diagram,
    activity,
  };
}

export { eventTypesForPageType };

export async function loadFunnelViewUrl(funnelId: string): Promise<string | null> {
  const funnel = await safe(
    getTenantPrisma().funnel.findFirst({
      where: { id: funnelId },
      select: { id: true, steps: true },
    }) as Promise<{ id: string; steps: unknown } | null>,
    null,
  );
  if (!funnel) return null;
  const pages = stepsToPages(stepsOf(funnel.steps));
  const { viewUrl } = await resolveViewUrl(funnel.id, pages);
  return viewUrl;
}
