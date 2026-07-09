import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { makeStorefrontCatalogReadSide } from '@/composition/make-commerce-gateway';
import { getCurrentTenantId, runWithTenant } from '@/lib/tenant/context';
import { nextStepInWorkflow } from '@/lib/funnel-step-order';
import { createLogger } from '@/lib/logger';
import {
  getPageFromCacheBySlug,
  setPageInCache,
  getPageMissFromCache,
  setPageMissInCache,
  type PageCacheData,
  getGlobalScriptsFromCache,
  setGlobalScriptsInCache,
  getFunnelScriptsFromCache,
  setFunnelScriptsInCache,
  type CachedScript,
  getFunnelContextFromCache,
  setFunnelContextInCache,
  type FunnelContextCacheData,
} from '@/lib/adapters/cache';
import {
  getBrandingName,
  getBrandingLogo,
  getBrandingFavicon,
  getDefaultCdnUrl,
} from '@/lib/config/keys';

const logger = createLogger('Storefront');

type ImageMapEntry = { map: Record<string, string>; expiry: number };
const _imageMapCache = new Map<string, ImageMapEntry>();
const IMAGE_MAP_CACHE_TTL = 10 * 60 * 1000;

async function getProductImageMap(): Promise<Record<string, string> | null> {
  const tenantId = getCurrentTenantId();
  const cached = _imageMapCache.get(tenantId);
  if (cached && Date.now() < cached.expiry) {
    return cached.map;
  }
  try {
    const read = makeStorefrontCatalogReadSide();
    const { products } = await read.list({ limit: 100, offset: 0 });
    const map: Record<string, string> = {};
    for (const p of products) {
      if (!p.thumbnail) continue;
      map[p.ref] = p.thumbnail;
      for (const v of p.variants) {
        map[v.ref] = v.thumbnail || p.thumbnail;
      }
    }
    _imageMapCache.set(tenantId, { map, expiry: Date.now() + IMAGE_MAP_CACHE_TTL });
    return map;
  } catch (e) {
    logger.warn('Failed to build product image map', { error: e });
    return null;
  }
}

export interface TenantInfo {
  id: string;
  name: string | null;
  favicon: any;
  logo: any;
  staticDomain: string | null;
}

export interface PaymentConfigPublic {
  paypal: {
    clientId: string;
    merchantId?: string;
    mode: string;
    currency: string;
    enableCardFields: boolean;
  } | null;

  providers?: Record<string, Record<string, any>>;
}

export interface StorefrontScript {
  id: string;
  content: string;
  position: string;
  order: number;
}

export function extractScriptsFromHtml(html: string): {
  htmlWithoutScripts: string;
  scripts: string[];
} {
  const scripts: string[] = [];
  const scriptRegex = /<script[^>]*>[\s\S]*?<\/script>/gi;
  const htmlWithoutScripts = html.replace(scriptRegex, (match) => {
    scripts.push(match);
    return '';
  });
  return { htmlWithoutScripts, scripts };
}

export async function getTenantInfo(tenantId?: string): Promise<TenantInfo | null> {
  const id = tenantId ?? getCurrentTenantId();
  const load = async (): Promise<TenantInfo> => {
    const [name, logo, favicon, staticDomain] = await Promise.all([
      getBrandingName(),
      getBrandingLogo(),
      getBrandingFavicon(),
      getDefaultCdnUrl(),
    ]);
    return {
      id,
      name: name ?? null,
      favicon: favicon ?? null,
      logo: logo ?? null,
      staticDomain: staticDomain ?? null,
    };
  };
  if (tenantId && tenantId !== getCurrentTenantId()) {
    return runWithTenant(tenantId, load);
  }
  return load();
}

function cacheDataToPage(data: PageCacheData): any {
  return {
    id: data.id,
    tenantId: data.tenantId,
    name: data.name,
    slug: data.slug,
    type: data.type,
    publishedData: data.publishedData,
    draftData: null,
    htmlContent: data.htmlContent,
    editorType: data.editorType,
    settings: data.settings,
    meta: data.meta,
    status: 'PUBLISHED',
  };
}

// A concrete (non-root) slug resolves to exactly one page, so a miss is safely negative-cacheable.
// The root path falls through several fallback queries whose answer a newly-created page can change,
// so it is never negative-cached.
function isNegativeCacheable(pageSlug: string): boolean {
  return !!pageSlug && pageSlug !== '/' && pageSlug !== '/index' && pageSlug !== 'index';
}

const _pageInFlight = new Map<string, Promise<any | null>>();

export async function findPage(pageSlug: string): Promise<any | null> {
  const slug = pageSlug || '/';
  const tenantId = getCurrentTenantId();

  const hit = await getPageFromCacheBySlug(tenantId, slug);
  if (hit) return cacheDataToPage(hit);

  const negativeCacheable = isNegativeCacheable(pageSlug);
  if (negativeCacheable && (await getPageMissFromCache(tenantId, slug))) return null;

  // Single-flight: collapse a concurrent burst on the same cold slug into one DB lookup.
  const flightKey = `${tenantId}:${slug}`;
  const inFlight = _pageInFlight.get(flightKey);
  if (inFlight) return inFlight;

  const work = (async () => {
    const page = await findPageWithStatusFilter(pageSlug, { status: 'PUBLISHED' as const });
    if (page && page.status === 'PUBLISHED' && (page.publishedData || page.htmlContent)) {
      await setPageInCache({
        id: page.id,
        tenantId: page.tenantId,
        name: page.name,
        slug: page.slug,
        type: page.type,
        publishedData: page.publishedData,
        htmlContent: page.htmlContent,
        editorType: page.editorType,
        settings: page.settings,
        meta: page.meta,
      });
    } else if (!page && negativeCacheable) {
      await setPageMissInCache(tenantId, slug);
    }
    return page;
  })();

  _pageInFlight.set(flightKey, work);
  try {
    return await work;
  } finally {
    _pageInFlight.delete(flightKey);
  }
}

export async function findPageIncludingDrafts(pageSlug: string): Promise<any | null> {
  return findPageWithStatusFilter(pageSlug, {});
}

async function findPageWithStatusFilter(
  pageSlug: string,
  statusFilter: Record<string, unknown>,
): Promise<any | null> {
  const prisma = getTenantPrisma();
  let page = await prisma.page.findFirst({
    where: {
      slug: pageSlug || '/',
      ...statusFilter,
    },
  });

  if (!page && (pageSlug === '' || pageSlug === '/' || !pageSlug)) {
    page = await prisma.page.findFirst({
      where: {
        slug: { in: ['/', '/index', 'index', ''] },
        ...statusFilter,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!page && (pageSlug === '' || pageSlug === '/' || !pageSlug)) {
    page = await prisma.page.findFirst({
      where: {
        type: 'CUSTOM',
        ...statusFilter,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!page && (pageSlug === '' || pageSlug === '/' || !pageSlug)) {
    page = await prisma.page.findFirst({
      where: {
        ...statusFilter,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  return page;
}

export async function getFunnelContext(
  pageId: string,
  funnelIdFromQuery: string | null
): Promise<{
  stepUrl: string;
  funnelId: string | null;
  funnelPageType: string | null;
  stepIndex: number;
}> {
  const tenantId = getCurrentTenantId();
  const hit = await getFunnelContextFromCache(tenantId, pageId, funnelIdFromQuery);
  if (hit) return hit;

  const resolved = await resolveFunnelStep(pageId, funnelIdFromQuery);

  const result: FunnelContextCacheData = {
    stepUrl: resolved.stepUrl ?? '',
    funnelId: resolved.funnelId,
    funnelPageType: resolved.funnelPageType,
    stepIndex: resolved.stepIndex,
  };
  await setFunnelContextInCache(tenantId, pageId, funnelIdFromQuery, result);
  return result;
}

interface FunnelStepResolution {
  stepUrl: string | null;
  funnelId: string | null;
  funnelPageType: string | null;
  stepIndex: number;
}

async function resolveFunnelStep(
  pageId: string,
  funnelIdFromQuery: string | null,
): Promise<FunnelStepResolution> {
  const empty: FunnelStepResolution = { stepUrl: null, funnelId: null, funnelPageType: null, stepIndex: 0 };
  const db = getTenantPrisma();

  const where = funnelIdFromQuery ? { id: funnelIdFromQuery } : {};
  const funnels = await db.funnel.findMany({ where, select: { id: true, steps: true } });

  for (const f of funnels) {
    const steps = Array.isArray(f.steps) ? (f.steps as Array<{ stepSlug?: string; pageId?: string }>) : [];
    if (!steps.some((s) => s?.pageId === pageId)) continue;

    // Resolve "next" by canonical workflow order (landing→checkout→upsell→thankyou), NOT raw array
    // order — an upsell appended after checkout would otherwise be skipped. Needs every step's page
    // type, so batch-load them once.
    const stepPageIds = steps.map((s) => s?.pageId).filter((id): id is string => !!id);
    const stepPages = await db.page.findMany({ where: { id: { in: stepPageIds } }, select: { id: true, type: true, slug: true } });
    const typeById = new Map(stepPages.map((p) => [p.id, p.type as string | null]));
    const slugById = new Map(stepPages.map((p) => [p.id, p.slug]));

    const { next, position } = nextStepInWorkflow(steps, typeById, pageId);

    // Forward navigation resolves to the NEXT step's page by pageId — a bare slug, no stepSlug
    // indirection. Internal nav (checkout → upsell/thankyou) is backend-driven; only the
    // hand-authored landing link uses /n/ + a landing stepSlug to stay stable across swaps.
    let stepUrl: string | null = null;
    if (next?.pageId) {
      const nextSlug = slugById.get(next.pageId);
      if (nextSlug) stepUrl = nextSlug.startsWith('/') ? nextSlug : `/${nextSlug}`;
    }

    return {
      stepUrl,
      funnelId: f.id,
      funnelPageType: typeById.get(pageId) ?? null,
      stepIndex: position,
    };
  }

  return empty;
}

export async function getGlobalScripts(): Promise<{
  headScripts: StorefrontScript[];
  bodyStartScripts: StorefrontScript[];
  bodyEndScripts: StorefrontScript[];
}> {
  const tenantId = getCurrentTenantId();
  let rows: CachedScript[] | null = await getGlobalScriptsFromCache(tenantId);
  if (!rows) {
    const found = await getTenantPrisma().globalScript.findMany({
      where: { enabled: true },
      orderBy: { order: 'asc' },
    });
    rows = found.map((s: { id: string; content: string; position: string; order: number }) => ({
      id: s.id,
      content: s.content,
      position: s.position,
      order: s.order,
    }));
    await setGlobalScriptsInCache(tenantId, rows);
  }
  const scripts: CachedScript[] = rows;
  return {
    headScripts: scripts.filter((s) => s.position === 'HEAD'),
    bodyStartScripts: scripts.filter((s) => s.position === 'BODY_START'),
    bodyEndScripts: scripts.filter((s) => s.position === 'BODY_END'),
  };
}

export async function getFunnelScripts(funnelId: string | null): Promise<{
  funnelHeadScripts: StorefrontScript[];
  funnelBodyStartScripts: StorefrontScript[];
  funnelBodyEndScripts: StorefrontScript[];
}> {
  const empty = { funnelHeadScripts: [], funnelBodyStartScripts: [], funnelBodyEndScripts: [] };
  if (!funnelId) return empty;

  let rows: CachedScript[] | null = await getFunnelScriptsFromCache(funnelId);
  if (!rows) {
    const found = await getTenantPrisma().funnelScript.findMany({
      where: { funnelId, isActive: true },
      orderBy: { order: 'asc' },
    });
    rows = found.map((s: { id: string; content: string; position: string; order: number }) => ({
      id: s.id,
      content: s.content,
      position: s.position,
      order: s.order,
    }));
    await setFunnelScriptsInCache(funnelId, rows);
  }
  const scripts: CachedScript[] = rows;

  return {
    funnelHeadScripts: scripts.filter((s) => s.position === 'HEAD'),
    funnelBodyStartScripts: scripts.filter((s) => s.position === 'BODY_START'),
    funnelBodyEndScripts: scripts.filter((s) => s.position === 'BODY_END'),
  };
}

export function extractProductCurrencyFromPuckData(puckData: any): string | null {
  if (!puckData) return null;

  function extractCurrency(sel: any): string | null {
    if (!sel) return null;
    if (!Array.isArray(sel) && sel.currency) return sel.currency;
    if (Array.isArray(sel) && sel[0]?.currency) return sel[0].currency;
    return null;
  }

  function scanComponents(components: any[], source: string): string | null {
    if (!Array.isArray(components)) return null;
    for (const comp of components) {
      if (comp.type === 'VariantSelector') {
        const currency = extractCurrency(comp.props?.selectedItems);
        if (currency) {
          logger.debug('Found product currency in puck data', { componentType: comp.type, source, currency });
          return currency;
        }
      }
      if (comp.props) {
        for (const [key, val] of Object.entries(comp.props)) {
          if (Array.isArray(val) && val.length > 0 && (val[0] as any)?.type && (val[0] as any)?.props) {
            const fromSlot = scanComponents(val, `${source} > ${comp.type}.${key}`);
            if (fromSlot) return fromSlot;
          }
        }
      }
    }
    return null;
  }

  const fromContent = scanComponents(puckData.content, 'content');
  if (fromContent) return fromContent;

  if (puckData.zones) {
    for (const zoneKey of Object.keys(puckData.zones)) {
      const fromZone = scanComponents(puckData.zones[zoneKey], `zone:${zoneKey}`);
      if (fromZone) return fromZone;
    }
  }

  logger.debug('No product currency found in puck data');
  return null;
}

export async function getPaymentConfig(pageType: string): Promise<PaymentConfigPublic> {
  const config: PaymentConfigPublic = { paypal: null, providers: {} };

  if (pageType !== 'CHECKOUT' && pageType !== 'UPSELL') {
    return config;
  }

  const { listActivePaymentProvidersWithCredentials } = await import('@/lib/config/payment');
  const { getProviderByDbKey } = await import('@/lib/adapters/payment/registry');
  await import('@/lib/adapters/payment/providers');

  const active = await listActivePaymentProvidersWithCredentials();

  for (const entry of active) {
    const registration = getProviderByDbKey(entry.provider);
    if (!registration || !registration.getPublicConfig) continue;

    const creds = entry.credentials as Record<string, any>;
    const settings = (entry.settings as Record<string, any>) || {};
    const publicConfig = registration.getPublicConfig(creds, settings);

    if (publicConfig) {
      config.providers![registration.paymentMethod] = publicConfig;
      if (registration.paymentMethod === 'paypal') {
        config.paypal = publicConfig as any;
      }
    }
  }

  return config;
}

export { getProductImageMap };
