import { describe, it, expect, beforeEach } from 'vitest';
import { setCache } from '@/lib/adapters/cache';
import { MemoryCacheAdapter } from '@/lib/adapters/cache/memory';
import {
  buildGlobalScriptsCacheKey,
  getGlobalScriptsFromCache,
  setGlobalScriptsInCache,
  invalidateGlobalScriptsCache,
  type CachedScript,
} from '@/lib/adapters/cache';
import {
  buildFunnelScriptsCacheKey,
  getFunnelScriptsFromCache,
  setFunnelScriptsInCache,
  invalidateFunnelScriptsCache,
} from '@/lib/adapters/cache';

let cache: MemoryCacheAdapter;
beforeEach(() => { cache = new MemoryCacheAdapter(); setCache(cache); });

const rows: CachedScript[] = [
  { id: 's1', content: '<script>a</script>', position: 'HEAD', order: 0 },
];

describe('global scripts cache', () => {
  it('round-trips through the cache by tenant', async () => {
    await setGlobalScriptsInCache('default', rows);
    expect(await getGlobalScriptsFromCache('default')).toEqual(rows);
    expect(await getGlobalScriptsFromCache('other')).toBeNull();
  });

  it('invalidate clears the tenant key', async () => {
    await setGlobalScriptsInCache('default', rows);
    await invalidateGlobalScriptsCache('default');
    expect(await cache.get(buildGlobalScriptsCacheKey('default'))).toBeNull();
  });
});

describe('funnel scripts cache', () => {
  it('round-trips by funnelId', async () => {
    await setFunnelScriptsInCache('f1', rows);
    expect(await getFunnelScriptsFromCache('f1')).toEqual(rows);
    expect(await getFunnelScriptsFromCache('f2')).toBeNull();
  });

  it('invalidate clears the funnel key', async () => {
    await setFunnelScriptsInCache('f1', rows);
    await invalidateFunnelScriptsCache('f1');
    expect(await cache.get(buildFunnelScriptsCacheKey('f1'))).toBeNull();
  });
});
