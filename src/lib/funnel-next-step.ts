import { getBasePrisma } from './db';
import { getDomainFromCache, setDomainInCache, getCache } from './adapters/cache';
import { createLogger } from './logger';
import { withTenantWhere } from './repositories/tenant-helpers';
import { nextStepInWorkflow } from './funnel-step-order';

const logger = createLogger('FunnelNextStep');

const REFERER_CHECK_TTL = 10 * 60;
const REFERER_CHECK_PREFIX = 'refchk:';

interface FunnelStep {
  stepSlug?: string;
  pageId?: string;
}

interface FunnelRow {
  id: string;
  name: string;
  steps: unknown;
}

function readSteps(steps: unknown): FunnelStep[] {
  return Array.isArray(steps) ? (steps as FunnelStep[]) : [];
}

function stepUrlFor(funnelId: string, stepSlug: string | null | undefined): string | null {
  return stepSlug ? `/n/${funnelId}/${stepSlug}` : null;
}

async function findFunnelsForPage(pageId: string): Promise<FunnelRow[]> {
  const prisma = getBasePrisma();
  return prisma.funnel.findMany({
    where: withTenantWhere({}),
    select: { id: true, name: true, steps: true },
  }).then((rows) =>
    rows.filter((f) => readSteps(f.steps).some((s) => s?.pageId === pageId)),
  );
}

// "Next step" must follow the funnel workflow (landing→checkout→upsell→thankyou), not the raw
// stored array order, so an upsell appended after checkout is still reached. Needs page types.
async function stepTypesByPageId(steps: FunnelStep[]): Promise<Map<string, string | null>> {
  const ids = steps.map((s) => s.pageId).filter((id): id is string => !!id);
  if (ids.length === 0) return new Map();
  const prisma = getBasePrisma();
  const pages = await prisma.page.findMany({
    where: withTenantWhere({ id: { in: ids } }),
    select: { id: true, type: true },
  });
  return new Map(pages.map((p) => [p.id, p.type as string | null]));
}

// True when the workflow step immediately after this page is an UPSELL — used to decide whether to
// defer PayPal capture at checkout so the upsell can be merged into the same order.
export async function funnelNextStepIsUpsell(pageId: string, funnelId: string | null | undefined): Promise<boolean> {
  const prisma = getBasePrisma();
  const where = funnelId ? withTenantWhere({ id: funnelId }) : withTenantWhere({});
  const funnels = await prisma.funnel.findMany({ where, select: { steps: true } });
  for (const f of funnels) {
    const steps = readSteps(f.steps);
    if (!steps.some((s) => s?.pageId === pageId)) continue;
    const types = await stepTypesByPageId(steps);
    const { next } = nextStepInWorkflow(steps, types, pageId);
    if (!next?.pageId) return false;
    return (types.get(next.pageId) ?? '').toUpperCase() === 'UPSELL';
  }
  return false;
}

export async function getFunnelNextStepUrlForPage(pageId: string): Promise<{
  nextStepUrl: string | null;
  funnelId: string | null;
  funnelName: string | null;
  currentPageType: string | null;
}> {
  const funnels = await findFunnelsForPage(pageId);
  for (const f of funnels) {
    const steps = readSteps(f.steps);
    if (!steps.some((s) => s?.pageId === pageId)) continue;
    const { next } = nextStepInWorkflow(steps, await stepTypesByPageId(steps), pageId);
    return {
      nextStepUrl: stepUrlFor(f.id, next?.stepSlug),
      funnelId: f.id,
      funnelName: f.name,
      currentPageType: null,
    };
  }
  return { nextStepUrl: null, funnelId: null, funnelName: null, currentPageType: null };
}

export async function getFunnelStepUrlForPage(pageId: string): Promise<{
  stepUrl: string | null;
  funnelId: string | null;
  funnelName: string | null;
  currentPageType: string | null;
  currentStepSlug: string | null;
}> {
  const funnels = await findFunnelsForPage(pageId);
  for (const f of funnels) {
    const step = readSteps(f.steps).find((s) => s?.pageId === pageId);
    if (!step) continue;
    return {
      stepUrl: stepUrlFor(f.id, step.stepSlug),
      funnelId: f.id,
      funnelName: f.name,
      currentPageType: null,
      currentStepSlug: step.stepSlug ?? null,
    };
  }
  return { stepUrl: null, funnelId: null, funnelName: null, currentPageType: null, currentStepSlug: null };
}

export async function getFunnelStepUrlForPageInFunnel(
  pageId: string,
  funnelId: string | null | undefined,
): Promise<{
  stepUrl: string | null;
  funnelId: string | null;
  funnelName: string | null;
  currentPageType: string | null;
  currentStepSlug: string | null;
}> {
  if (!funnelId) return getFunnelStepUrlForPage(pageId);
  const prisma = getBasePrisma();
  const funnel = await prisma.funnel.findFirst({
    where: withTenantWhere({ id: funnelId }),
    select: { id: true, name: true, steps: true },
  });
  const step = funnel ? readSteps(funnel.steps).find((s) => s?.pageId === pageId) : undefined;
  if (!funnel || !step) {
    return { stepUrl: null, funnelId: null, funnelName: null, currentPageType: null, currentStepSlug: null };
  }
  return {
    stepUrl: stepUrlFor(funnel.id, step.stepSlug),
    funnelId: funnel.id,
    funnelName: funnel.name,
    currentPageType: null,
    currentStepSlug: step.stepSlug ?? null,
  };
}

export async function getFunnelNextStepUrlForPageInFunnel(
  pageId: string,
  funnelId: string | null | undefined,
): Promise<{
  nextStepUrl: string | null;
  funnelId: string | null;
  funnelName: string | null;
  currentPageType: string | null;
}> {
  if (!funnelId) return getFunnelNextStepUrlForPage(pageId);
  const prisma = getBasePrisma();
  const funnel = await prisma.funnel.findFirst({
    where: withTenantWhere({ id: funnelId }),
    select: { id: true, name: true, steps: true },
  });
  if (!funnel) {
    return { nextStepUrl: null, funnelId: null, funnelName: null, currentPageType: null };
  }
  const steps = readSteps(funnel.steps);
  if (!steps.some((s) => s?.pageId === pageId)) {
    return { nextStepUrl: null, funnelId: null, funnelName: null, currentPageType: null };
  }
  const { next } = nextStepInWorkflow(steps, await stepTypesByPageId(steps), pageId);
  return {
    nextStepUrl: stepUrlFor(funnel.id, next?.stepSlug),
    funnelId: funnel.id,
    funnelName: funnel.name,
    currentPageType: null,
  };
}


export async function validateRedirectReferer(
  referer: string | null,
  funnelId: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (!referer) {
    logger.info('Referer check: no referer header, allowing', { funnelId });
    return { valid: true };
  }

  let refererUrl: URL;
  try {
    refererUrl = new URL(referer);
  } catch {
    logger.info('Referer check: malformed referer, allowing', { referer, funnelId });
    return { valid: true };
  }

  const hostname = refererUrl.hostname.toLowerCase();
  const pathname = refererUrl.pathname;

  logger.info('Referer check start', { referer, hostname, pathname, funnelId });

  const cache = getCache();
  const cacheKey = `${REFERER_CHECK_PREFIX}${funnelId}:${hostname}:${pathname}`;
  const cached = await cache.get<{ valid: boolean; reason?: string }>(cacheKey);
  if (cached !== null) {
    logger.info('Referer check: cache hit', { cacheKey, cached });
    return cached;
  }

  let result: { valid: boolean; reason?: string };

  try {
    const refererPageId = await resolvePageIdFromUrl(hostname, pathname);
    logger.info('Referer check: resolved pageId', { hostname, pathname, refererPageId });

    if (!refererPageId) {
      logger.info('Referer check: page not found, allowing', { hostname, pathname });
      result = { valid: true };
    } else {
      const prisma = getBasePrisma();
      const funnel = await prisma.funnel.findFirst({
        where: withTenantWhere({ id: funnelId }),
        select: { steps: true },
      });
      const belongs = funnel ? readSteps(funnel.steps).some((s) => s?.pageId === refererPageId) : false;

      if (!belongs) {
        logger.warn('Redirect referer validation failed', { referer, refererPageId, funnelId });
        result = { valid: false, reason: 'Page does not belong to this funnel' };
      } else {
        result = { valid: true };
      }
    }
  } catch (err) {
    logger.error('Redirect referer validation error', { error: err, referer, funnelId });
    result = { valid: true };
  }

  cache.set(cacheKey, result, REFERER_CHECK_TTL).catch(() => {});
  return result;
}


async function resolvePageIdFromUrl(
  hostname: string,
  pathname: string,
): Promise<string | null> {
  const prisma = getBasePrisma();
  const storefrontMatch = pathname.match(/^\/storefront\/(.*)$/);
  if (storefrontMatch) {
    const refSlug = storefrontMatch[1] ? `/${storefrontMatch[1]}` : '/';
    logger.info('resolvePageIdFromUrl: storefront preview', { refSlug });
    const page = await prisma.page.findFirst({
      where: { slug: refSlug },
      select: { id: true },
    });
    return page?.id ?? null;
  }

  let domainData = await getDomainFromCache(hostname);
  logger.info('resolvePageIdFromUrl: domain cache', { hostname, found: !!domainData, tenantId: domainData?.tenantId });
  if (!domainData) {
    const dbDomain = await prisma.domain.findFirst({ where: { host: hostname } });
    logger.info('resolvePageIdFromUrl: domain DB', { hostname, found: !!dbDomain, tenantId: dbDomain?.tenantId });
    if (dbDomain) {
      domainData = {
        tenantId: dbDomain.tenantId,
        domain: dbDomain.host,
        isPrimary: dbDomain.isPrimary,
      };
      setDomainInCache(domainData).catch((err) => {
        logger.error('Failed to cache domain data', { error: err, hostname });
      });
    }
  }

  if (!domainData) {
    logger.info('resolvePageIdFromUrl: domain not found, returning null', { hostname });
    return null;
  }

  const rawSlug = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const slugVariants = rawSlug === '/'
    ? ['/', '', '/index', 'index']
    : [rawSlug, rawSlug.replace(/^\//, '')];

  const page = await prisma.page.findFirst({
    where: { tenantId: domainData.tenantId, slug: { in: slugVariants } },
    select: { id: true },
  });
  logger.info('resolvePageIdFromUrl: page lookup', { tenantId: domainData.tenantId, slugVariants, pageId: page?.id });
  return page?.id ?? null;
}
