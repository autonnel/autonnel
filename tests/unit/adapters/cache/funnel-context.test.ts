import { describe, it, expect, beforeEach } from 'vitest';
import { setCache } from '@/lib/adapters/cache';
import { MemoryCacheAdapter } from '@/lib/adapters/cache/memory';
import {
  buildFunnelContextCacheKey,
  getFunnelContextFromCache,
  setFunnelContextInCache,
  invalidateFunnelContextForPage,
  type FunnelContextCacheData,
} from '@/lib/adapters/cache';

let cache: MemoryCacheAdapter;
beforeEach(() => { cache = new MemoryCacheAdapter(); setCache(cache); });

const ctx: FunnelContextCacheData = {
  stepUrl: '/n/f1/checkout', funnelId: 'f1', funnelPageType: 'CHECKOUT', stepIndex: 0,
};

describe('funnel context cache', () => {
  it('keys by tenant + page + query funnel (none when null)', async () => {
    expect(buildFunnelContextCacheKey('default', 'p1', null)).toBe('funnelctx2:default:p1:none');
    expect(buildFunnelContextCacheKey('default', 'p1', 'f1')).toBe('funnelctx2:default:p1:f1');
  });

  it('round-trips', async () => {
    await setFunnelContextInCache('default', 'p1', null, ctx);
    expect(await getFunnelContextFromCache('default', 'p1', null)).toEqual(ctx);
  });

  it('invalidateFunnelContextForPage clears every query-funnel variant of that page', async () => {
    await setFunnelContextInCache('default', 'p1', null, ctx);
    await setFunnelContextInCache('default', 'p1', 'f1', ctx);
    await setFunnelContextInCache('default', 'p2', null, ctx);
    await invalidateFunnelContextForPage('default', 'p1');
    expect(await getFunnelContextFromCache('default', 'p1', null)).toBeNull();
    expect(await getFunnelContextFromCache('default', 'p1', 'f1')).toBeNull();
    expect(await getFunnelContextFromCache('default', 'p2', null)).toEqual(ctx);
  });
});
