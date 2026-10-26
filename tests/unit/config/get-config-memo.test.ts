import { describe, it, expect, vi } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock('@/composition/make-platform', () => ({
  makePlatform: () => ({
    getEffectiveConfig: { get: async (key: string) => store.get(key) ?? null },
    setConfig: { set: async (key: string, value: unknown) => void store.set(key, value) },
  }),
}));
vi.mock('@/lib/tenant/context', () => ({ getCurrentTenantId: () => 'default' }));

import { getConfig, setConfig, deleteConfig } from '@/lib/config/get-config';

describe('getConfig memo', () => {
  it('reads its own writes and deletes within the memo window', async () => {
    await setConfig('memo.key', { a: 1 });
    expect(await getConfig('memo.key')).toEqual({ a: 1 });

    await deleteConfig('memo.key');
    expect(await getConfig('memo.key')).toBeUndefined();

    await setConfig('memo.key', { a: 2 });
    expect(await getConfig('memo.key')).toEqual({ a: 2 });
  });
});
