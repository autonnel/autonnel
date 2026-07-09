export * from './types';
export * from './memory';

import { getMemoryCache } from './memory';
import type { CacheAdapter, RedirectCacheData } from './types';
import { isCloudflareRuntime, readEnv } from '@/lib/runtime/env';
import { createLogger } from '@/lib/logger';

// Node-only deps guard: dynamic import prevents workerd eager-graph validation failure
const _kvMod: any = isCloudflareRuntime() ? await import('./cloudflare-kv') : null;
const _redisMod: any = isCloudflareRuntime() ? null : await import('./redis');

const logger = createLogger('Cache');

let cacheAdapter: CacheAdapter | null = null;

export function getCache(): CacheAdapter {
  if (cacheAdapter) return cacheAdapter;
  if (isCloudflareRuntime()) {
    logger.info('Using Cloudflare KV adapter');
    cacheAdapter = new _kvMod!.CloudflareKVCacheAdapter();
  } else if (readEnv('REDIS_URL') || readEnv('REDIS_HOST')) {
    logger.info('Using Redis adapter');
    cacheAdapter = _redisMod!.getRedisCache();
  } else {
    logger.info('Using Memory adapter');
    cacheAdapter = getMemoryCache();
  }
  return cacheAdapter!;
}

export function setCache(adapter: CacheAdapter): void {
  cacheAdapter = adapter;
}

const CACHE_TTL = {
  PAGE: 24 * 60 * 60,
  REDIRECT: 12 * 60 * 60,
  FUNNEL: 12 * 60 * 60,
  DOMAIN: 24 * 60 * 60,
  SHORT: 5 * 60,
  TEMPORARY: 60,
  TRACKING_PARAMS: 30 * 24 * 60 * 60,
  SCRIPTS: 12 * 60 * 60,
  FUNNEL_CTX: 12 * 60 * 60,
  // Negative cache for not-found slugs: short so a newly published page appears quickly,
  // long enough to keep a bot hammering a bad slug off the DB.
  NOT_FOUND: 30,
} as const;

export { CACHE_TTL };

// Spread expiries by ±10% so a burst of entries written together (e.g. a cache warm or a
// post-deploy stampede) don't all expire on the same tick and re-stampede the DB at once.
function withJitter(ttlSeconds: number): number {
  const spread = ttlSeconds * 0.1;
  return Math.round(ttlSeconds - spread + Math.random() * spread * 2);
}

export { withJitter };

// Key prefixes: never change — these are runtime-visible cache keys.
const PFX_REDIRECT = 'redirect:';
const PFX_PAGE = 'page:';
const PFX_FUNNEL = 'funnel:';
const PFX_DOMAIN = 'domain:';
const PFX_TRACKING = 'tracking:';
const PFX_SCRIPTS_GLOBAL = 'scripts:global:';
const PFX_SCRIPTS_FUNNEL = 'scripts:funnel:';
const PFX_FUNNEL_CTX = 'funnelctx2:';

function ns<T>(buildKey: (...args: string[]) => string, ttl: number) {
  return {
    read: (...args: string[]) => getCache().get<T>(buildKey(...args)),
    write: (data: T, ...args: string[]) => getCache().set(buildKey(...args), data, withJitter(ttl)),
    drop: (...args: string[]) => getCache().delete(buildKey(...args)),
  };
}

const redirectKey = (stepSlug: string) => `${PFX_REDIRECT}${stepSlug}`;
const redirectNs = ns<RedirectCacheData>(redirectKey, CACHE_TTL.REDIRECT);

export async function getRedirectFromCache(stepSlug: string): Promise<RedirectCacheData | null> {
  return redirectNs.read(stepSlug);
}

export async function setRedirectInCache(stepSlug: string, data: RedirectCacheData): Promise<void> {
  await redirectNs.write(data, stepSlug);
}

export async function invalidateRedirectCache(stepSlug: string): Promise<void> {
  await redirectNs.drop(stepSlug);
}

export async function invalidateAllRedirectCaches(): Promise<void> {
  await getCache().deletePattern(`${PFX_REDIRECT}*`);
}

export interface PageCacheData {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  type: string;
  publishedData: any;
  htmlContent: string | null;
  editorType: string;
  settings: any;
  meta: any;
}

export function buildPageCacheKeyById(tenantId: string, pageId: string): string {
  return `${PFX_PAGE}${tenantId}:id:${pageId}`;
}

export function buildPageCacheKeyBySlug(tenantId: string, slug: string): string {
  return `${PFX_PAGE}${tenantId}:slug:${slug}`;
}

export async function getPageFromCacheById(tenantId: string, pageId: string): Promise<PageCacheData | null> {
  return getCache().get<PageCacheData>(buildPageCacheKeyById(tenantId, pageId));
}

export async function getPageFromCacheBySlug(tenantId: string, slug: string): Promise<PageCacheData | null> {
  return getCache().get<PageCacheData>(buildPageCacheKeyBySlug(tenantId, slug));
}

export async function setPageInCache(data: PageCacheData): Promise<void> {
  await Promise.all([
    getCache().set(buildPageCacheKeyById(data.tenantId, data.id), data, withJitter(CACHE_TTL.PAGE)),
    getCache().set(buildPageCacheKeyBySlug(data.tenantId, data.slug), data, withJitter(CACHE_TTL.PAGE)),
  ]);
}

export async function invalidatePageCache(tenantId: string, pageId: string, slug?: string): Promise<void> {
  const tasks = [getCache().delete(buildPageCacheKeyById(tenantId, pageId))];
  if (slug) {
    tasks.push(getCache().delete(buildPageCacheKeyBySlug(tenantId, slug)));
    // Drop any negative marker so a newly-published page on a previously-404'd slug appears at once.
    tasks.push(getCache().delete(buildPageMissCacheKey(tenantId, slug)));
  }
  await Promise.all(tasks);
}

export async function invalidateAllPageCachesForTenant(tenantId: string): Promise<void> {
  await getCache().deletePattern(`${PFX_PAGE}${tenantId}:*`);
}

// Negative cache: a known-missing slug. Keyed under the page namespace so publishing a page
// (which invalidates `${PFX_PAGE}${tenantId}:*`) also clears any stale "not found" marker.
function buildPageMissCacheKey(tenantId: string, slug: string): string {
  return `${PFX_PAGE}${tenantId}:miss:${slug}`;
}

export async function getPageMissFromCache(tenantId: string, slug: string): Promise<boolean> {
  return (await getCache().get<true>(buildPageMissCacheKey(tenantId, slug))) === true;
}

export async function setPageMissInCache(tenantId: string, slug: string): Promise<void> {
  await getCache().set(buildPageMissCacheKey(tenantId, slug), true, withJitter(CACHE_TTL.NOT_FOUND));
}

export interface FunnelCacheData {
  id: string;
  name: string;
  steps: Array<{
    id: string;
    order: number;
    type: string;
    pageId: string;
    stepSlug: string | null;
  }>;
  settings: any;
}

export function buildFunnelCacheKey(funnelId: string): string {
  return `${PFX_FUNNEL}${funnelId}`;
}

export async function getFunnelFromCache(funnelId: string): Promise<FunnelCacheData | null> {
  return getCache().get<FunnelCacheData>(buildFunnelCacheKey(funnelId));
}

export async function setFunnelInCache(data: FunnelCacheData): Promise<void> {
  await getCache().set(buildFunnelCacheKey(data.id), data, CACHE_TTL.FUNNEL);
}

export async function invalidateFunnelCache(funnelId: string): Promise<void> {
  await getCache().delete(buildFunnelCacheKey(funnelId));
}

export interface DomainCacheData {
  tenantId: string;
  domain: string;
  isPrimary: boolean;
}

export function buildDomainCacheKey(domain: string): string {
  return `${PFX_DOMAIN}${domain.toLowerCase()}`;
}

export async function getDomainFromCache(domain: string): Promise<DomainCacheData | null> {
  return getCache().get<DomainCacheData>(buildDomainCacheKey(domain));
}

export async function setDomainInCache(data: DomainCacheData): Promise<void> {
  await getCache().set(buildDomainCacheKey(data.domain), data, CACHE_TTL.DOMAIN);
}

export async function invalidateDomainCache(domain: string): Promise<void> {
  await getCache().delete(buildDomainCacheKey(domain));
}

export async function invalidateAllDomainCaches(domains: string[]): Promise<void> {
  await Promise.all(domains.map((d) => invalidateDomainCache(d)));
}

export interface TrackingParamsCacheData {
  trackingId: string;
  tenantId: string;
  urlParams: Record<string, string>;
  firstSeenAt: string;
  lastSeenAt: string;
  referrer?: string;
  landingPage?: string;
}

export function buildTrackingParamsCacheKey(tenantId: string, trackingId: string): string {
  return `${PFX_TRACKING}${tenantId}:${trackingId}`;
}

function legacyTrackingKey(trackingId: string): string {
  return `${PFX_TRACKING}${trackingId}`;
}

export async function getTrackingParamsFromCache(
  trackingId: string,
  tenantId: string,
): Promise<TrackingParamsCacheData | null> {
  const scoped = await getCache().get<TrackingParamsCacheData>(
    buildTrackingParamsCacheKey(tenantId, trackingId),
  );
  if (scoped) return scoped;

  const legacy = await getCache().get<TrackingParamsCacheData>(legacyTrackingKey(trackingId));
  return legacy?.tenantId === tenantId ? legacy : null;
}

export async function setTrackingParamsInCache(
  trackingId: string,
  tenantId: string,
  urlParams: Record<string, string>,
  meta?: { referrer?: string; landingPage?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getTrackingParamsFromCache(trackingId, tenantId);

  const record: TrackingParamsCacheData = existing
    ? { ...existing, urlParams: { ...urlParams, ...existing.urlParams }, lastSeenAt: now }
    : {
        trackingId,
        tenantId,
        urlParams,
        firstSeenAt: now,
        lastSeenAt: now,
        referrer: meta?.referrer,
        landingPage: meta?.landingPage,
      };

  await getCache().set(buildTrackingParamsCacheKey(tenantId, trackingId), record, CACHE_TTL.TRACKING_PARAMS);
}

export async function deleteTrackingParamsFromCache(trackingId: string, tenantId: string): Promise<void> {
  await Promise.all([
    getCache().delete(buildTrackingParamsCacheKey(tenantId, trackingId)),
    getCache().delete(legacyTrackingKey(trackingId)),
  ]);
}

export interface CachedScript {
  id: string;
  content: string;
  position: string;
  order: number;
}

export function buildGlobalScriptsCacheKey(tenantId: string): string {
  return `${PFX_SCRIPTS_GLOBAL}${tenantId}`;
}

export async function getGlobalScriptsFromCache(tenantId: string): Promise<CachedScript[] | null> {
  return getCache().get<CachedScript[]>(buildGlobalScriptsCacheKey(tenantId));
}

export async function setGlobalScriptsInCache(tenantId: string, scripts: CachedScript[]): Promise<void> {
  await getCache().set(buildGlobalScriptsCacheKey(tenantId), scripts, CACHE_TTL.SCRIPTS);
}

export async function invalidateGlobalScriptsCache(tenantId: string): Promise<void> {
  await getCache().delete(buildGlobalScriptsCacheKey(tenantId));
}

export function buildFunnelScriptsCacheKey(funnelId: string): string {
  return `${PFX_SCRIPTS_FUNNEL}${funnelId}`;
}

export async function getFunnelScriptsFromCache(funnelId: string): Promise<CachedScript[] | null> {
  return getCache().get<CachedScript[]>(buildFunnelScriptsCacheKey(funnelId));
}

export async function setFunnelScriptsInCache(funnelId: string, scripts: CachedScript[]): Promise<void> {
  await getCache().set(buildFunnelScriptsCacheKey(funnelId), scripts, CACHE_TTL.SCRIPTS);
}

export async function invalidateFunnelScriptsCache(funnelId: string): Promise<void> {
  await getCache().delete(buildFunnelScriptsCacheKey(funnelId));
}

export interface FunnelContextCacheData {
  stepUrl: string;
  funnelId: string | null;
  funnelPageType: string | null;
  stepIndex: number;
}

export function buildFunnelContextCacheKey(
  tenantId: string,
  pageId: string,
  funnelId: string | null,
): string {
  return `${PFX_FUNNEL_CTX}${tenantId}:${pageId}:${funnelId ?? 'none'}`;
}

export async function getFunnelContextFromCache(
  tenantId: string,
  pageId: string,
  funnelId: string | null,
): Promise<FunnelContextCacheData | null> {
  return getCache().get<FunnelContextCacheData>(buildFunnelContextCacheKey(tenantId, pageId, funnelId));
}

export async function setFunnelContextInCache(
  tenantId: string,
  pageId: string,
  funnelId: string | null,
  data: FunnelContextCacheData,
): Promise<void> {
  await getCache().set(buildFunnelContextCacheKey(tenantId, pageId, funnelId), data, CACHE_TTL.FUNNEL_CTX);
}

// Trailing wildcard only: precise on memory (regex) AND Cloudflare KV (prefix-only).
export async function invalidateFunnelContextForPage(tenantId: string, pageId: string): Promise<void> {
  await getCache().deletePattern(`${PFX_FUNNEL_CTX}${tenantId}:${pageId}:*`);
}

export async function invalidateFunnelContextForPages(tenantId: string, pageIds: string[]): Promise<void> {
  await Promise.all(pageIds.map((pid) => invalidateFunnelContextForPage(tenantId, pid)));
}
