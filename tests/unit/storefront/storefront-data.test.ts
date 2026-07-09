import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    page: { findFirst: vi.fn(), findMany: vi.fn() },
    funnel: { findMany: vi.fn() },
    funnelPage: { findFirst: vi.fn(), findMany: vi.fn() },
    globalScript: { findMany: vi.fn() },
    funnelScript: { findMany: vi.fn() },
    appConfig: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  default: prismaMock,
  getBasePrisma: () => prismaMock,
  getRequestDb: () => ({ tenant: prismaMock }),
}));
vi.mock('@/lib/runtime/env', () => ({
  getEnv: () => undefined,
  isCloudflareRuntime: () => false,
  getBinding: () => undefined,
}));
vi.mock('@/lib/config/keys', () => ({
  getBrandingName: () => Promise.resolve(undefined),
  getBrandingLogo: () => Promise.resolve(undefined),
  getBrandingFavicon: () => Promise.resolve(undefined),
  getDefaultCdnUrl: () => Promise.resolve(undefined),
  getGoogleMapsApiKey: () => Promise.resolve(undefined),
}));
vi.mock('@/lib/config/payment', () => ({
  listPaymentProviders: () => Promise.resolve([]),
  getPaymentProviderEntryWithCredentials: () => Promise.resolve(null),
  listActivePaymentProvidersWithCredentials: () => Promise.resolve([]),
}));

import { setCache } from '@/lib/adapters/cache';
import { MemoryCacheAdapter } from '@/lib/adapters/cache/memory';
import {
  buildPageCacheKeyBySlug,
  type PageCacheData,
} from '@/lib/adapters/cache';
import { findPage, findPageIncludingDrafts, getStorefrontPageData } from '@/lib/storefront/storefront-data.service';

let cache: MemoryCacheAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  cache = new MemoryCacheAdapter();
  setCache(cache);
});

const cached: PageCacheData = {
  id: 'p1',
  tenantId: 'default',
  name: 'Checkout',
  slug: 'checkout-wellness',
  type: 'CHECKOUT',
  publishedData: { content: [] },
  htmlContent: null,
  editorType: 'PUCK',
  settings: { headContent: '' },
  meta: { title: 'Checkout' },
};

describe('findPage read-through cache', () => {
  it('returns the cached page without querying the DB on a cache hit', async () => {
    await cache.set(buildPageCacheKeyBySlug('default', 'checkout-wellness'), cached);
    const page = await findPage('checkout-wellness');
    expect(page.id).toBe('p1');
    expect(page.type).toBe('CHECKOUT');
    expect(page.publishedData).toEqual({ content: [] });
    expect(prismaMock.page.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the DB on a miss and populates the cache', async () => {
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'p1', tenantId: 'default', name: 'Checkout', slug: 'checkout-wellness',
      type: 'CHECKOUT', status: 'PUBLISHED', publishedData: { content: [] },
      htmlContent: null, editorType: 'PUCK', settings: {}, meta: {},
    });
    const page = await findPage('checkout-wellness');
    expect(page.id).toBe('p1');
    expect(prismaMock.page.findFirst).toHaveBeenCalledTimes(1);
    const stored = await cache.get<PageCacheData>(buildPageCacheKeyBySlug('default', 'checkout-wellness'));
    expect(stored?.id).toBe('p1');
  });

  it('findPageIncludingDrafts never reads or writes the published cache', async () => {
    await cache.set(buildPageCacheKeyBySlug('default', 'checkout-wellness'), cached);
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'draft', tenantId: 'default', slug: 'checkout-wellness', type: 'CHECKOUT',
      status: 'DRAFT', draftData: { content: ['draft'] }, publishedData: null,
    });
    const page = await findPageIncludingDrafts('checkout-wellness');
    expect(page.id).toBe('draft');
    expect(prismaMock.page.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('getStorefrontPageData parallelization', () => {
  beforeEach(() => {
    prismaMock.globalScript.findMany.mockResolvedValue([]);
    prismaMock.funnelScript.findMany.mockResolvedValue([]);
    prismaMock.funnel.findMany.mockResolvedValue([]);
    prismaMock.page.findMany.mockResolvedValue([]);
    prismaMock.funnelPage.findFirst.mockResolvedValue(null);
    prismaMock.funnelPage.findMany.mockResolvedValue([]);
  });

  it('returns a full StorefrontPageData with the page resolved from cache', async () => {
    await cache.set(buildPageCacheKeyBySlug('default', 'checkout-wellness'), cached);
    const data = await getStorefrontPageData('checkout-wellness', null);
    expect(data).not.toBeNull();
    expect(data!.page.id).toBe('p1');
    expect(data!.paymentConfig).toBeDefined();
    expect(Array.isArray(data!.headScripts)).toBe(true);
  });

  it('returns null and does not load funnel/payment when the page is missing', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);
    const data = await getStorefrontPageData('does-not-exist', null);
    expect(data).toBeNull();
    expect(prismaMock.funnelPage.findFirst).not.toHaveBeenCalled();
  });
});
