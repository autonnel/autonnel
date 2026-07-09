import { describe, it, expect, beforeEach } from 'vitest';
import { registerPlugins } from '@/integration/register-plugins';
import { generateBuilderExtModuleSource } from '@/integration/builder-ext-virtual';
import {
  resetUiAndPolicyRegistry,
  getActiveAuthProvider,
  getPolicyHooks,
  getUiSlot,
  getUiSlotList,
  getNavHidden,
  getLoginExtras,
} from '@/lib/plugins/registry';
import {
  setPluginAdsPlatforms,
  getAdsPlatforms,
} from '@/lib/adapters/ads/platform-registry';
import { DEFAULT_POLICY_HOOKS } from '@/lib/hooks/policy/defaults';
import type { AutonnelPlugin } from '@/lib/plugins/types';
import type { User } from '@prisma/client';

const ctx = {} as any;

function pluginAlpha(): AutonnelPlugin {
  return {
    name: 'alpha',
    version: '1.0.0',
    authProvider: {
      name: 'alpha-auth',
      verifySession: async () => null as User | null,
      renderLoginExtras: () => '<div id="alpha-extra"></div>',
    },
    policyHooks: {
      maxCustomDomains: () => 3,
    },
    uiSlots: {
      'settings.storage.replace': { entrypoint: 'alpha/Storage.astro' },
      'settings.menu.append': [{ id: 'alpha-menu', label: 'Alpha', href: '/alpha' }],
      'nav.hidden': ['alpha.section'],
    },
    adsPlatforms: [{ id: 'ALPHA_ADS', label: 'Alpha Ads', mode: 'token' }],
  };
}

function pluginBeta(): AutonnelPlugin {
  return {
    name: 'beta',
    version: '1.0.0',
    policyHooks: {
      maxCustomDomains: () => 9,
    },
    uiSlots: {
      'settings.storage.replace': { entrypoint: 'beta/Storage.astro' },
      'settings.menu.append': [{ id: 'beta-menu', label: 'Beta', href: '/beta' }],
      'sidebar.system.append': [{ id: 'beta-side', label: 'BetaSide', href: '/beta-side' }],
      'nav.hidden': ['beta.section'],
    },
    adsPlatforms: [
      { id: 'ALPHA_ADS', label: 'Alpha Ads (overridden)', mode: 'oauth' },
      { id: 'BETA_ADS', label: 'Beta Ads', mode: 'token' },
    ],
  };
}

describe('registerPlugins', () => {
  beforeEach(() => {
    resetUiAndPolicyRegistry();
    setPluginAdsPlatforms([]);
  });

  it('dispatches every capability from a single plugin to the right setter', async () => {
    registerPlugins([pluginAlpha()]);

    const provider = getActiveAuthProvider();
    expect(provider?.name).toBe('alpha-auth');

    const extras = await getLoginExtras();
    expect(extras).toContain('alpha-extra');

    const ctxLocal = ctx;
    expect(await getPolicyHooks().maxCustomDomains(ctxLocal)).toBe(3);

    expect(getUiSlot('settings.storage.replace')?.entrypoint).toBe('alpha/Storage.astro');
    expect(getUiSlotList('settings.menu.append').map((m) => m.id)).toEqual(['alpha-menu']);
    expect(getNavHidden()).toEqual(['alpha.section']);

    const ads = getAdsPlatforms();
    expect(ads.find((a) => a.id === 'ALPHA_ADS')?.label).toBe('Alpha Ads');
  });

  it('merges two plugins: concat lists, last-wins single slots, later overrides policy, ads override by id', async () => {
    registerPlugins([pluginAlpha(), pluginBeta()]);

    // single-value slot: last-wins
    expect(getUiSlot('settings.storage.replace')?.entrypoint).toBe('beta/Storage.astro');

    // list slots: concat
    expect(getUiSlotList('settings.menu.append').map((m) => m.id)).toEqual(['alpha-menu', 'beta-menu']);
    expect(getUiSlotList('sidebar.system.append').map((m) => m.id)).toEqual(['beta-side']);
    expect(getNavHidden()).toEqual(['alpha.section', 'beta.section']);

    // policy: later plugin overrides earlier
    expect(await getPolicyHooks().maxCustomDomains(ctx)).toBe(9);

    // ads: concat with plugin-override-by-id (beta overrides ALPHA_ADS)
    const ads = getAdsPlatforms();
    expect(ads.find((a) => a.id === 'ALPHA_ADS')?.label).toBe('Alpha Ads (overridden)');
    expect(ads.find((a) => a.id === 'ALPHA_ADS')?.mode).toBe('oauth');
    expect(ads.find((a) => a.id === 'BETA_ADS')).toBeDefined();
  });

  it('registerPlugins([]) sets policy to defaults, empty uiSlots, ads = core only', async () => {
    registerPlugins([]);

    const hooks = getPolicyHooks();
    expect(await hooks.maxCustomDomains(ctx)).toBe(await DEFAULT_POLICY_HOOKS.maxCustomDomains(ctx));
    expect(await hooks.storageBannerEnabled()).toBe(await DEFAULT_POLICY_HOOKS.storageBannerEnabled());

    expect(getUiSlot('settings.storage.replace')).toBeUndefined();
    expect(getUiSlotList('settings.menu.append')).toEqual([]);
    expect(getUiSlotList('sidebar.system.append')).toEqual([]);
    expect(getNavHidden()).toEqual([]);

    const ads = getAdsPlatforms();
    expect(ads.find((a) => a.id === 'FACEBOOK')).toBeDefined();
    expect(ads.find((a) => a.id === 'ALPHA_ADS')).toBeUndefined();
  });
});

describe('generateBuilderExtModuleSource', () => {
  it('emits the empty baseline for zero plugins', () => {
    expect(generateBuilderExtModuleSource([])).toBe('export const builderExtensions = [];\n');
  });
});
