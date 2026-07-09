import { describe, it, expect } from 'vitest';

describe('MaintenancePanel module', () => {
  // Bumped timeout: pulling in React + the DS button/card + lucide-react
  // lazily through Vite SSR commonly takes 2-4s on cold workers; the default
  // 5s threshold is too tight when this test lands in a slow shard.
  it('imports without throwing', { timeout: 60_000 }, async () => {
    const mod = await import('@/components/settings/MaintenancePanel');
    expect(typeof mod.default).toBe('function');
  });
});
