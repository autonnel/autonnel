import { describe, it, expect, beforeEach } from 'vitest';
import { registerPlugins } from '@/integration/register-plugins';
import {
  resetUiAndPolicyRegistry,
  getConversionSubscribers,
  getPluginJobHandlers,
  getPluginSettingsPanels,
  getPluginSettingsPanel,
  getUiSlotList,
  getPluginCrons,
  getPluginModels,
} from '@/lib/plugins/registry';
import { InvalidPluginContractError } from '@/lib/plugins/errors';
import type { AutonnelPlugin } from '@/lib/plugins/types';

function tracker(overrides: Partial<AutonnelPlugin> = {}): AutonnelPlugin {
  return {
    name: 'tracker',
    version: '1.0.0',
    onConversion: async () => {},
    jobHandlers: { 'plugin.tracker.postback': async () => ({ ok: true }) },
    settingsPanels: [
      { id: 'tracker', title: 'Tracker', configKey: 'tracker.config', fields: [{ key: 'url', label: 'URL', type: 'url' }] },
    ],
    ...overrides,
  };
}

describe('registerPlugins runtime parts', () => {
  beforeEach(() => resetUiAndPolicyRegistry());

  it('collects conversion subscribers, job handlers and settings panels', () => {
    registerPlugins([tracker()]);

    expect(getConversionSubscribers().map((s) => s.pluginName)).toEqual(['tracker']);
    expect(Object.keys(getPluginJobHandlers())).toEqual(['plugin.tracker.postback']);
    expect(getPluginJobHandlers()['plugin.tracker.postback'].pluginName).toBe('tracker');
    expect(getPluginSettingsPanels().map((p) => p.id)).toEqual(['tracker']);
    expect(getPluginSettingsPanel('tracker')?.configKey).toBe('tracker.config');
    expect(getPluginSettingsPanel('missing')).toBeUndefined();
  });

  it('adds a settings menu entry for every panel after explicit menu items', () => {
    registerPlugins([
      tracker({ uiSlots: { 'settings.menu.append': [{ id: 'explicit', label: 'Explicit', href: '/x' }] } }),
    ]);

    expect(getUiSlotList('settings.menu.append')).toEqual([
      { id: 'settings.plugin.tracker', label: 'Tracker', href: '/settings/plugins/tracker' },
      { id: 'explicit', label: 'Explicit', href: '/x' },
    ]);
  });

  it('rejects job kinds outside the plugin namespace', () => {
    expect(() => registerPlugins([tracker({ jobHandlers: { 'ads.postback.dispatch': async () => null } })])).toThrow(
      InvalidPluginContractError,
    );
  });

  it('rejects a job kind claimed by two plugins', () => {
    const second = tracker({ name: 'other', settingsPanels: [] });
    expect(() => registerPlugins([tracker(), second])).toThrow(/already registered by tracker/);
  });

  it('rejects duplicate or malformed panel ids', () => {
    expect(() => registerPlugins([tracker(), tracker({ name: 'other', jobHandlers: {} })])).toThrow(/already registered/);
    const bad = tracker({
      settingsPanels: [{ id: '../etc', title: 'Bad', configKey: 'bad', fields: [] }],
    });
    expect(() => registerPlugins([bad])).toThrow(/must match/);
  });

  it('clears runtime parts on reset so re-registration starts clean', () => {
    registerPlugins([tracker()]);
    resetUiAndPolicyRegistry();
    expect(getConversionSubscribers()).toEqual([]);
    expect(getPluginJobHandlers()).toEqual({});
    expect(getPluginSettingsPanels()).toEqual([]);
  });

  it('collects plugin crons and the models each plugin declares', () => {
    const run = async () => {};
    registerPlugins([
      tracker({
        crons: [{ name: 'plugin.tracker.sync', intervalMs: 10 * 60_000, run }],
        schemaExtension: 'model TrackerSync {\n  id String @id\n  tenantId String\n}\n',
      }),
    ]);
    expect(getPluginCrons()).toEqual([{ pluginName: 'tracker', cron: { name: 'plugin.tracker.sync', intervalMs: 600_000, run } }]);
    expect(getPluginModels('tracker')).toEqual(['TrackerSync']);
    expect(getPluginModels('unknown')).toEqual([]);
  });

  it.each([
    ['a name outside the plugin namespace', { name: 'ads.postback', intervalMs: 300_000 }, /must match/],
    ['an interval below one minute', { name: 'plugin.tracker.fast', intervalMs: 1_000 }, /intervalMs must be an integer/],
    ['a non-integer interval', { name: 'plugin.tracker.odd', intervalMs: 90_000.5 }, /intervalMs must be an integer/],
  ])('rejects a cron with %s', (_label, cron, message) => {
    expect(() => registerPlugins([tracker({ crons: [{ ...cron, run: async () => {} }] })])).toThrow(message);
  });

  it('rejects the same cron name from two plugins', () => {
    const cron = { name: 'plugin.shared', intervalMs: 300_000, run: async () => {} };
    const other = tracker({ name: 'other', jobHandlers: {}, settingsPanels: [], crons: [cron] });
    expect(() => registerPlugins([tracker({ crons: [cron] }), other])).toThrow(/already registered by tracker/);
  });

  it('rejects an invalid schemaExtension at registration time', () => {
    expect(() => registerPlugins([tracker({ schemaExtension: 'model NoTenant {\n  id String @id\n}\n' })])).toThrow(
      /tenantId String/,
    );
  });
});
