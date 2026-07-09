import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  getMarketplaceCatalogUrl,
  getMarketplaceProductUrl,
  fetchMarketplaceTemplatePacks,
} from '@/lib/marketplace/public-catalog';

const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
  delete process.env.MARKETPLACE_BASE_URL;
});

describe('getMarketplaceCatalogUrl', () => {
  it('defaults to https://autonnel.com', () => {
    expect(getMarketplaceCatalogUrl()).toBe('https://autonnel.com');
  });

  it('honors MARKETPLACE_BASE_URL and strips a trailing slash', () => {
    process.env.MARKETPLACE_BASE_URL = 'http://localhost:4559/';
    expect(getMarketplaceCatalogUrl()).toBe('http://localhost:4559');
    expect(getMarketplaceProductUrl('atelier')).toBe('http://localhost:4559/marketplace/atelier');
  });
});

describe('fetchMarketplaceTemplatePacks', () => {
  it('maps the public DTO subset and queries kind=template', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        generatedAt: '2026-06-20T00:00:00.000Z',
        items: [
          {
            slug: 'atelier',
            kind: 'template',
            title: 'Atelier',
            tagline: 'Quiet-luxury fragrance funnel.',
            category: 'Beauty',
            tags: ['luxury'],
            priceCents: 5900,
            currency: 'usd',
            heroImage: '/marketplace/heroes/atelier.svg',
            featured: true,
            npmPackage: '@autonnel/template-atelier',
            latestVersion: '0.1.0',
          },
        ],
      }),
    })) as any;
    global.fetch = fetchMock;

    const packs = await fetchMarketplaceTemplatePacks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/marketplace/items.json?kind=template');
    expect(packs).toEqual([
      {
        slug: 'atelier',
        title: 'Atelier',
        tagline: 'Quiet-luxury fragrance funnel.',
        category: 'Beauty',
        priceCents: 5900,
        heroImage: '/marketplace/heroes/atelier.svg',
        npmPackage: '@autonnel/template-atelier',
      },
    ]);
  });

  it('returns [] (fail-soft) on a network error', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as any;
    expect(await fetchMarketplaceTemplatePacks()).toEqual([]);
  });

  it('returns [] on a non-200 response', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as any;
    expect(await fetchMarketplaceTemplatePacks()).toEqual([]);
  });

  it('returns [] when the body has no items array', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ items: null }) })) as any;
    expect(await fetchMarketplaceTemplatePacks()).toEqual([]);
  });
});
