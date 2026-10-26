import { getBasePrisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import {
  DEPTH_BANDS,
  bandForPct,
  bandLabel,
  classifyVisit,
  emptyBands,
  screensTall as screensFromViewport,
  type BandRow,
  type QuadrantCounts,
} from '@/lib/stats/engagement';
import type { AnalyticsWindow } from './analytics-helpers';
import { loadSourceVisitorIds, SOURCE_VISITOR_LIMIT } from './analytics-data';

const logger = createLogger('dashboard:interest');

export interface InterestVisit {
  pageId: string;
  funnelId: string | null;
  dwellMs: number;
  activeMs: number | null;
  maxScrollPct: number | null;
  viewportPct: number | null;
  dwellByDepth: number[];
  interactions: string[];
}

export interface InterestAggregate {
  pageId: string;
  funnelId: string | null;
  uv: number;
  counts: QuadrantCounts;
  medianDwellMs: number | null;
  activeCoverage: number;
  screensTall: number | null;
  screensCoverage: number;
  bands: BandRow[];
  /** Visits whose tracker reported a full-length dwellByDepth; the population `bands` is built from. */
  measuredRows: number;
  /** Distinct funnelId values behind this page, so a shared page is not labelled with one of them. */
  funnelCount: number;
}

export interface InterestRow extends InterestAggregate {
  pageName: string | null;
  pageSlug: string | null;
  pageType: string | null;
  funnelName: string | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// Reach counts visitors for whom the band was on screen at all. A zero is a
// visitor who never got there; averaging those in reports every band as
// barely-seen on a page most people leave early.
function buildBands(rows: InterestVisit[]): { bands: BandRow[]; measured: number } {
  const visible: number[][] = Array.from({ length: DEPTH_BANDS }, () => []);
  const exits = emptyBands();
  const acts = emptyBands();
  let measured = 0;

  for (const r of rows) {
    if (Array.isArray(r.dwellByDepth) && r.dwellByDepth.length === DEPTH_BANDS) {
      measured += 1;
      for (let i = 0; i < DEPTH_BANDS; i += 1) {
        if (r.dwellByDepth[i] > 0) visible[i].push(r.dwellByDepth[i]);
      }
    }
    if (r.maxScrollPct !== null && r.maxScrollPct !== undefined) {
      exits[bandForPct(r.maxScrollPct)] += 1;
    }
    // One visitor who clicked a link and opened an FAQ in the same band acted
    // once, not twice: the column answers how many people acted there.
    const actedBands = new Set<number>();
    for (const raw of r.interactions ?? []) {
      const idx = Number(String(raw).split(':')[0]);
      if (Number.isInteger(idx) && idx >= 0 && idx < DEPTH_BANDS) actedBands.add(idx);
    }
    for (const idx of actedBands) acts[idx] += 1;
  }

  if (measured === 0) return { bands: [], measured };

  return {
    bands: Array.from({ length: DEPTH_BANDS }, (_, i) => ({
      index: i,
      label: bandLabel(i),
      reached: visible[i].length,
      medianVisibleMs: median(visible[i]),
      exits: exits[i],
      interactions: acts[i],
    })),
    measured,
  };
}

function medianScreens(rows: InterestVisit[]): number | null {
  const screens = rows
    .map((r) => screensFromViewport(r.viewportPct))
    .filter((v): v is number => v !== null);
  if (screens.length === 0) return null;
  const sorted = [...screens].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function aggregateInterest(visits: InterestVisit[]): Map<string, InterestAggregate> {
  const byPage = new Map<string, InterestVisit[]>();
  for (const v of visits) {
    const list = byPage.get(v.pageId);
    if (list) list.push(v);
    else byPage.set(v.pageId, [v]);
  }

  const out = new Map<string, InterestAggregate>();
  for (const [pageId, rows] of byPage) {
    const counts: QuadrantCounts = { BOUNCED: 0, SKIMMED: 0, STALLED: 0, ENGAGED: 0 };
    for (const r of rows) counts[classifyVisit(r)] += 1;
    const { bands, measured } = buildBands(rows);
    // One checkout page can be referenced by many funnels; naming one of them
    // over a UV summed across all of them would attribute the whole row to it.
    const distinctFunnels = new Set(rows.map((r) => r.funnelId));
    out.set(pageId, {
      pageId,
      funnelId: distinctFunnels.size === 1 ? rows[0].funnelId : null,
      funnelCount: distinctFunnels.size,
      uv: rows.length,
      counts,
      // Foreground time where it exists: a median mixing the two clocks reads
      // high by however many tabs were parked.
      medianDwellMs: median(rows.map((r) => r.activeMs ?? r.dwellMs)),
      activeCoverage: rows.filter((r) => r.activeMs !== null).length / rows.length,
      screensTall: medianScreens(rows),
      screensCoverage: rows.filter((r) => r.viewportPct !== null).length / rows.length,
      bands,
      measuredRows: measured,
    });
  }
  return out;
}

// getBasePrisma() bypasses the tenant Prisma extension, so the tenantId
// predicate has to be explicit here or this reads every tenant's orders.
async function buyerVisitorIds(start: Date, end: Date): Promise<string[]> {
  const tenantId = getCurrentTenantId();
  const rows = await getBasePrisma().$queryRaw<Array<{ visitorId: string | null }>>`
    SELECT o."attribution"->>'visitorId' AS "visitorId"
      FROM orders o
     WHERE o."tenantId" = ${tenantId}
       AND o."createdAt" >= ${start} AND o."createdAt" < ${end}
       AND o."attribution"->>'visitorId' IS NOT NULL
     LIMIT ${SOURCE_VISITOR_LIMIT}
  `;
  const ids = [...new Set(rows.map((r) => r.visitorId).filter((v): v is string => !!v))];
  if (rows.length >= SOURCE_VISITOR_LIMIT) {
    logger.warn('buyer exclusion incomplete; buyers past the cap stay counted, so UV reads higher than it should', {
      limit: SOURCE_VISITOR_LIMIT,
      excluded: ids.length,
    });
  }
  return ids;
}

export async function loadPrimaryStorefrontHost(): Promise<string | null> {
  const { getDomainRepository } = await import('@/lib/repositories/domain.repository');
  const primary = await getDomainRepository().getPrimary();
  return primary?.host ?? null;
}

export async function loadInterestRows(opts: {
  funnelId?: string | null;
  source?: string | null;
  excludeBuyers: boolean;
  window: AnalyticsWindow;
}): Promise<InterestRow[]> {
  const db = getTenantPrisma();
  const { start, end } = opts.window;

  const sourceVisitorIds = opts.source
    ? await loadSourceVisitorIds({ funnelId: opts.funnelId ?? null, source: opts.source, start, end })
    : null;
  if (sourceVisitorIds && sourceVisitorIds.length === 0) return [];

  const buyers = opts.excludeBuyers ? await buyerVisitorIds(start, end) : [];

  const where: Record<string, unknown> = { occurredAt: { gte: start, lt: end } };
  if (opts.funnelId) where.funnelId = opts.funnelId;
  if (sourceVisitorIds) where.visitorId = { in: sourceVisitorIds };
  if (buyers.length) {
    where.visitorId = sourceVisitorIds
      ? { in: sourceVisitorIds, notIn: buyers }
      : { notIn: buyers };
  }

  const visits = (await db.pageEngagement.findMany({
    where: where as never,
    select: {
      pageId: true, funnelId: true, dwellMs: true, activeMs: true,
      maxScrollPct: true, viewportPct: true, dwellByDepth: true, interactions: true,
    },
  })) as InterestVisit[];

  logger.info('interest query', {
    funnelId: opts.funnelId ?? null,
    source: opts.source ?? null,
    excludeBuyers: opts.excludeBuyers,
    rows: visits.length,
  });
  if (visits.length === 0) return [];

  const aggregates = aggregateInterest(visits);

  const pages = await db.page.findMany({
    where: { id: { in: [...aggregates.keys()] } },
    select: { id: true, name: true, slug: true, type: true },
  });
  const pageById = new Map(pages.map((p) => [p.id, p]));

  const funnelIds = [...new Set([...aggregates.values()].map((a) => a.funnelId).filter((f): f is string => !!f))];
  const funnels = funnelIds.length
    ? await db.funnel.findMany({ where: { id: { in: funnelIds } }, select: { id: true, name: true } })
    : [];
  const funnelById = new Map(funnels.map((f) => [f.id, f.name]));

  const rows: InterestRow[] = [...aggregates.values()].map((a) => {
    const page = pageById.get(a.pageId);
    return {
      ...a,
      pageName: page?.name || null,
      pageSlug: page?.slug ?? null,
      pageType: page?.type ?? null,
      funnelName: a.funnelId ? funnelById.get(a.funnelId) ?? null : null,
    };
  });

  rows.sort((x, y) => y.uv - x.uv);
  return rows;
}
