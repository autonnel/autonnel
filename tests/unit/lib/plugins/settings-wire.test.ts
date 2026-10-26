import { describe, it, expect, vi } from 'vitest';

const { getConfig, findMany } = vi.hoisted(() => ({
  getConfig: vi.fn(async () => ({ url: 'https://stale.example' })),
  findMany: vi.fn(async () => [
  { id: 'j1', status: 'FAILED', attemptCount: 2, maxAttempts: 12, payload: { label: 'purchase S1' }, failureReason: 'HTTP 503', createdAt: new Date(0), updatedAt: new Date(0) },
  { id: 'j2', status: 'SUCCEEDED', attemptCount: 1, maxAttempts: 12, payload: { url: 'x' }, failureReason: null, createdAt: new Date(0), updatedAt: new Date(0) },
  ]),
}));
vi.mock('@/lib/config/get-config', () => ({ getConfig }));
vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({ getTenantPrisma: () => ({ job: { findMany } }) }));

import { loadPluginSettingsWire } from '@/lib/plugins/settings-wire';
import type { PluginSettingsPanel } from '@/lib/plugins/types';

const panel: PluginSettingsPanel = {
  id: 'tracker',
  title: 'Tracker',
  configKey: 'tracker.config',
  jobKinds: ['plugin.tracker.send'],
  fields: [{ key: 'url', label: 'URL', type: 'url' }],
  validate: () => null,
};

describe('loadPluginSettingsWire', () => {
  it('reads stored config and maps job rows with their payload label', async () => {
    const wire = await loadPluginSettingsWire(panel);
    expect(wire.hasConfig).toBe(true);
    expect(wire.values).toEqual({ url: 'https://stale.example' });
    expect(wire.panel).not.toHaveProperty('validate');
    expect(wire.jobs.map((j) => [j.id, j.label, j.failureReason])).toEqual([['j1', 'purchase S1', 'HTTP 503'], ['j2', null, null]]);
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { kind: { in: ['plugin.tracker.send'] } }, take: 20 });
  });

  it('uses the just-written value instead of the cached read after a write', async () => {
    getConfig.mockClear();
    const saved = await loadPluginSettingsWire(panel, { stored: { url: 'https://new.example' } });
    expect(saved.values).toEqual({ url: 'https://new.example' });
    const removed = await loadPluginSettingsWire(panel, { stored: null });
    expect(removed.hasConfig).toBe(false);
    expect(getConfig).not.toHaveBeenCalled();
  });
});
