import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileDesignToHtml, _resetModuleCacheForTests } from './compile';
import { page, section, text } from './_shared';

vi.mock('@/lib/adapters/cache', () => ({
  getCache: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('compileDesignToHtml', () => {
  beforeEach(() => _resetModuleCacheForTests());

  it('compiles a minimal page to HTML', async () => {
    const design = page({ rows: [section({ children: [text({ html: 'Hello' })] })] });
    const html = await compileDesignToHtml(design);
    expect(html).toContain('<html');
    expect(html).toContain('Hello');
  });

  it('returns the same string from in-process cache on repeat call with same cacheKey', async () => {
    const design = page({ rows: [section({ children: [text({ html: 'Cached' })] })] });
    const a = await compileDesignToHtml(design, { cacheKey: 'k1' });
    const b = await compileDesignToHtml(design, { cacheKey: 'k1' });
    expect(a).toBe(b);
  });

  it('prevents second compilation when in-process cache is hit', async () => {
    const JsonToMjmlMod = await import('easy-email-core');
    const spy = vi.spyOn(JsonToMjmlMod, 'JsonToMjml');

    const design = page({ rows: [section({ children: [text({ html: 'CacheHit' })] })] });
    await compileDesignToHtml(design, { cacheKey: 'k2' });
    await compileDesignToHtml(design, { cacheKey: 'k2' });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
