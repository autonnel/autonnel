import { describe, it, expect, vi } from 'vitest';

// Separate file because getPinnedFetch memoizes its probe at module scope; a fresh module
// registry is the only way to observe the workerd branch without the Node probe having run.
vi.mock('@/lib/runtime/env', () => ({
  isCloudflareRuntime: () => true,
  readEnv: () => undefined,
}));

describe('getPinnedFetch on workerd', () => {
  it('returns null so callers take their own non-pinned path', async () => {
    const { getPinnedFetch } = await import('../pinned-fetch');
    await expect(getPinnedFetch()).resolves.toBeNull();
  });

  it('stays null on repeat calls', async () => {
    const { getPinnedFetch } = await import('../pinned-fetch');
    await getPinnedFetch();
    await expect(getPinnedFetch()).resolves.toBeNull();
  });
});
