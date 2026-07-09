import { toPublicFunnelUrl } from '@/lib/dashboard/funnels-helpers';

// Recall resume link: send an abandoned shopper back to the funnel checkout step, carrying their
// visitor id (anid) so tracking/postback re-associates, plus the campaign coupon (auto-applied via
// ?coupon=CODE). No signature — the funnel URL is public and the coupon is validated server-side.

interface FunnelStepJson {
  stepSlug?: string;
  pageId?: string;
}

interface OrderAttribution {
  visitorId?: string;
  funnelId?: string;
  firstSeenUrl?: string;
}

interface ActivityEventRow {
  funnelId: string | null;
  url: string | null;
}

export interface ResumeLinkPrisma {
  order: { findFirst(args: unknown): Promise<{ attribution: unknown } | null> };
  userActivityEvent: {
    findFirst(args: unknown): Promise<ActivityEventRow | null>;
  };
  funnel: { findUnique(args: unknown): Promise<{ steps: unknown } | null> };
  page: { findMany(args: unknown): Promise<Array<{ id: string; type: string }>> };
  domain: { findFirst(args: unknown): Promise<{ host: string } | null> };
}

export function assembleResumeUrl(input: {
  host: string | null;
  funnelId: string;
  checkoutStepSlug: string;
  visitorId: string | null;
  coupon?: string | null;
}): string {
  const qs = new URLSearchParams();
  if (input.visitorId) qs.set('anid', input.visitorId);
  if (input.coupon) qs.set('coupon', input.coupon);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const path = `/n/${input.funnelId}/${input.checkoutStepSlug}`;
  return `${toPublicFunnelUrl(path, input.host) ?? path}${query}`;
}

export async function buildRecallResumeUrl(
  db: ResumeLinkPrisma,
  saleRef: string,
  opts: { coupon?: string | null } = {},
): Promise<string | null> {
  const order = await db.order.findFirst({ where: { saleRef }, select: { attribution: true } });
  const attribution = (order?.attribution ?? {}) as OrderAttribution;
  const visitorId = attribution.visitorId ?? null;
  if (!visitorId) return null;

  // Prefer the snapshot captured on the order; fall back to the visitor's raw activity events
  // (anid is the only shared identifier — the order's checkout sessionId is a different id space).
  let funnelId = attribution.funnelId ?? null;
  let entryFirstUrl = attribution.firstSeenUrl ?? null;

  if (!funnelId) {
    const recent = await db.userActivityEvent.findFirst({
      where: { visitorId, funnelId: { not: null } },
      orderBy: { occurredAt: 'desc' },
      select: { funnelId: true },
    });
    funnelId = recent?.funnelId ?? null;
  }
  if (!funnelId) return null;

  if (!entryFirstUrl) {
    const firstView = await db.userActivityEvent.findFirst({
      where: { visitorId, kind: 'page_view' },
      orderBy: { occurredAt: 'asc' },
      select: { url: true },
    });
    entryFirstUrl = firstView?.url ?? null;
  }

  let entryHost: string | null = null;
  if (entryFirstUrl) {
    try {
      entryHost = new URL(entryFirstUrl).host;
    } catch {
      entryHost = null;
    }
  }

  const funnel = await db.funnel.findUnique({ where: { id: funnelId }, select: { steps: true } });
  const steps = Array.isArray(funnel?.steps) ? (funnel!.steps as FunnelStepJson[]) : [];
  const pageIds = steps.map((s) => s.pageId).filter((id): id is string => Boolean(id));
  if (pageIds.length === 0) return null;

  const pages = await db.page.findMany({ where: { id: { in: pageIds } }, select: { id: true, type: true } });
  const checkoutPageIds = new Set(pages.filter((p) => p.type.toUpperCase() === 'CHECKOUT').map((p) => p.id));
  const checkoutStep = steps.find((s) => s.pageId && checkoutPageIds.has(s.pageId));
  if (!checkoutStep?.stepSlug) return null;

  const primaryDomain = await db.domain.findFirst({
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: { host: true },
  });

  return assembleResumeUrl({
    host: entryHost ?? primaryDomain?.host ?? null,
    funnelId,
    checkoutStepSlug: checkoutStep.stepSlug,
    visitorId,
    coupon: opts.coupon,
  });
}
