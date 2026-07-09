import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/runtime/env', () => ({
  isCloudflareRuntime: () => false,
  getEnv: () => undefined,
  getBinding: () => undefined,
}));

import {
  CACHE_TTL,
  setCache,
  getCache,
  buildPageCacheKeyById,
  buildPageCacheKeyBySlug,
  buildFunnelCacheKey,
  buildDomainCacheKey,
  buildTrackingParamsCacheKey,
  setRedirectInCache,
  getRedirectFromCache,
  invalidateRedirectCache,
  setPageInCache,
  getPageFromCacheById,
  getPageFromCacheBySlug,
  invalidatePageCache,
  setFunnelInCache,
  getFunnelFromCache,
  setDomainInCache,
  getDomainFromCache,
  invalidateAllDomainCaches,
  setTrackingParamsInCache,
  getTrackingParamsFromCache,
  deleteTrackingParamsFromCache,
} from '@/lib/adapters/cache';
import { MemoryCacheAdapter } from '@/lib/adapters/cache/memory';

beforeEach(() => {
  setCache(new MemoryCacheAdapter());
});

describe('cache module — key builders', () => {
  it('buildPageCacheKey* derives ID and slug keys per tenant', () => {
    expect(buildPageCacheKeyById('t1', 'p1')).toBe('page:t1:id:p1');
    expect(buildPageCacheKeyBySlug('t1', '/x')).toBe('page:t1:slug:/x');
  });

  it('builds funnel / domain / tracking keys', () => {
    expect(buildFunnelCacheKey('f1')).toBe('funnel:f1');
    expect(buildDomainCacheKey('Example.COM')).toBe('domain:example.com');
    expect(buildTrackingParamsCacheKey('tenant', 't1')).toBe('tracking:tenant:t1');
  });
});

describe('cache module — typed helpers', () => {
  it('redirect cache set/get/invalidate', async () => {
    await setRedirectInCache('go', { funnelId: 'f', pageId: 'p' } as any);
    expect(await getRedirectFromCache('go')).toBeTruthy();
    await invalidateRedirectCache('go');
    expect(await getRedirectFromCache('go')).toBeNull();
  });

  it('page cache stores by both id and slug', async () => {
    const data = {
      id: 'p1',
      tenantId: 't1',
      name: 'X',
      slug: '/x',
      type: 'L',
      publishedData: {},
      htmlContent: null,
      editorType: 'puck',
      settings: {},
      meta: {},
    };
    await setPageInCache(data);
    expect(await getPageFromCacheById('t1', 'p1')).toEqual(data);
    expect(await getPageFromCacheBySlug('t1', '/x')).toEqual(data);
    await invalidatePageCache('t1', 'p1', '/x');
    expect(await getPageFromCacheById('t1', 'p1')).toBeNull();
  });

  it('funnel cache stores and retrieves data', async () => {
    await setFunnelInCache({ id: 'f', name: 'F', steps: [], settings: {} });
    expect(await getFunnelFromCache('f')).toBeTruthy();
  });

  it('domain cache normalizes domain to lowercase', async () => {
    await setDomainInCache({ tenantId: 't1', domain: 'Example.COM', isPrimary: true });
    expect(await getDomainFromCache('example.com')).toBeTruthy();
    expect(await getDomainFromCache('EXAMPLE.com')).toBeTruthy();
    await invalidateAllDomainCaches(['example.com']);
    expect(await getDomainFromCache('example.com')).toBeNull();
  });

  it('tracking params cache merges new params with existing (existing wins)', async () => {
    await setTrackingParamsInCache('tid', 'tenant', { fbclid: 'first' });
    await setTrackingParamsInCache('tid', 'tenant', { fbclid: 'second', new: 'x' });
    const got = await getTrackingParamsFromCache('tid', 'tenant');
    expect(got?.urlParams.fbclid).toBe('first');
    expect(got?.urlParams.new).toBe('x');
    expect(await getTrackingParamsFromCache('tid', 'other-tenant')).toBeNull();
    await deleteTrackingParamsFromCache('tid', 'tenant');
    expect(await getTrackingParamsFromCache('tid', 'tenant')).toBeNull();
  });
});

describe('cache module — selection', () => {
  it('CACHE_TTL constants are exported with sane values', () => {
    expect(CACHE_TTL.PAGE).toBeGreaterThan(0);
    expect(CACHE_TTL.SHORT).toBeLessThan(CACHE_TTL.PAGE);
  });

  it('getCache returns the adapter set via setCache', () => {
    const c = new MemoryCacheAdapter();
    setCache(c);
    expect(getCache()).toBe(c);
  });
});
