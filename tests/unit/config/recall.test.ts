import { describe, it, expect, vi, beforeEach } from 'vitest';

const { kvStore } = vi.hoisted(() => ({
  kvStore: new Map<string, unknown>(),
}));

vi.mock('@/lib/config/get-config', () => ({
  getConfig: vi.fn(async (key: string) => kvStore.get(key) ?? undefined),
  setConfig: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, value);
  }),
  deleteConfig: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
}));

import {
  getRecallKvConfig,
  upsertRecallKvConfig,
  DEFAULT_RECALL_INTERVALS,
} from '@/lib/config/recall';

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('recall KV accessor', () => {
  it('returns null (not defaults) when nothing stored', async () => {
    expect(await getRecallKvConfig()).toBeNull();
  });

  it('upserts a new config', async () => {
    const cfg = await upsertRecallKvConfig({
      isEnabled: true,
      intervals: [{ hours: 24, emailTemplateType: 'RECALL_1' }],
    });
    expect(cfg.id).toMatch(/.+/);
    expect(cfg.isEnabled).toBe(true);
    expect(cfg.intervals).toEqual([{ hours: 24, emailTemplateType: 'RECALL_1' }]);
  });

  it('preserves id on subsequent upserts', async () => {
    const a = await upsertRecallKvConfig({ isEnabled: false, intervals: [] });
    const b = await upsertRecallKvConfig({
      isEnabled: true,
      intervals: [{ hours: 1, emailTemplateType: 'RECALL_1' }],
    });
    expect(b.id).toBe(a.id);
    expect(b.isEnabled).toBe(true);
  });

  it('exposes the default intervals constant', () => {
    expect(DEFAULT_RECALL_INTERVALS).toEqual([
      { hours: 24, emailTemplateType: 'RECALL_1' },
      { hours: 72, emailTemplateType: 'RECALL_2' },
      { hours: 168, emailTemplateType: 'RECALL_3' },
    ]);
  });
});
