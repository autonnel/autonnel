import { describe, it, expect, vi } from 'vitest';
import { assembleResumeUrl, buildRecallResumeUrl, type ResumeLinkPrisma } from './resume-link';

describe('assembleResumeUrl', () => {
  it('builds an absolute checkout URL with anid + coupon', () => {
    const url = assembleResumeUrl({
      host: 'shop.example.com',
      funnelId: 'fn1',
      checkoutStepSlug: 'buy',
      visitorId: 'vis_1',
      coupon: 'SAVE10',
    });
    expect(url).toBe('https://shop.example.com/n/fn1/buy?anid=vis_1&coupon=SAVE10');
  });

  it('uses http for localhost and omits absent params', () => {
    const url = assembleResumeUrl({ host: 'localhost:4591', funnelId: 'fn1', checkoutStepSlug: 'buy', visitorId: null });
    expect(url).toBe('http://localhost:4591/n/fn1/buy');
  });

  it('falls back to a relative path when no host is resolved', () => {
    const url = assembleResumeUrl({ host: null, funnelId: 'fn1', checkoutStepSlug: 'buy', visitorId: 'v', coupon: 'C' });
    expect(url).toBe('/n/fn1/buy?anid=v&coupon=C');
  });
});

describe('buildRecallResumeUrl', () => {
  // funnelId lookup (where.funnelId) vs entry-url lookup (where.kind === 'page_view').
  const activity = (funnelId: string | null, url: string | null) => ({
    findFirst: vi.fn(async (args: { where?: { kind?: string } }) =>
      args?.where?.kind === 'page_view'
        ? { funnelId: null, url }
        : funnelId === null
          ? null
          : { funnelId, url: null },
    ),
  });

  const db = (over: Partial<ResumeLinkPrisma> = {}): ResumeLinkPrisma => ({
    order: { findFirst: vi.fn(async () => ({ attribution: { visitorId: 'vis_1' } })) },
    userActivityEvent: activity('fn1', null),
    funnel: { findUnique: vi.fn(async () => ({ steps: [{ stepSlug: 'lp', pageId: 'p_lp' }, { stepSlug: 'buy', pageId: 'p_co' }] })) },
    page: { findMany: vi.fn(async () => [{ id: 'p_lp', type: 'LANDING' }, { id: 'p_co', type: 'CHECKOUT' }]) },
    domain: { findFirst: vi.fn(async () => ({ host: 'shop.example.com' })) },
    ...over,
  });

  it('resolves saleRef -> visitorId -> funnel checkout step and includes coupon (primary-domain fallback)', async () => {
    const url = await buildRecallResumeUrl(db(), 'sale_1', { coupon: 'SAVE10' });
    expect(url).toBe('https://shop.example.com/n/fn1/buy?anid=vis_1&coupon=SAVE10');
  });

  it('prefers the entry host from the first activity event over the primary domain', async () => {
    const url = await buildRecallResumeUrl(
      db({ userActivityEvent: activity('fn1', 'https://entry.example.com/n/fn1/lp?x=1') }),
      'sale_1',
      { coupon: 'SAVE10' },
    );
    expect(url).toBe('https://entry.example.com/n/fn1/buy?anid=vis_1&coupon=SAVE10');
  });

  it('returns null when the order has no visitorId', async () => {
    const url = await buildRecallResumeUrl(
      db({ order: { findFirst: vi.fn(async () => ({ attribution: {} })) } }),
      'sale_1',
    );
    expect(url).toBeNull();
  });

  it('returns null when no activity event carries a funnel for the visitor', async () => {
    const url = await buildRecallResumeUrl(db({ userActivityEvent: activity(null, null) }), 'sale_1');
    expect(url).toBeNull();
  });

  it('returns null when the funnel has no checkout step', async () => {
    const url = await buildRecallResumeUrl(
      db({ page: { findMany: vi.fn(async () => [{ id: 'p_lp', type: 'LANDING' }, { id: 'p_co', type: 'UPSELL' }]) } }),
      'sale_1',
    );
    expect(url).toBeNull();
  });
});
