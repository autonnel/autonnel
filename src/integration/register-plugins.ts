import type { AutonnelPlugin, AdsPlatformMeta, PolicyHooks } from '@/lib/plugins/types';
import {
  setActiveAuthProvider,
  registerLoginExtras,
  setActivePolicyHooks,
  setActiveUiSlots,
  type ActiveUiSlots,
} from '@/lib/plugins/registry';
import { DEFAULT_POLICY_HOOKS } from '@/lib/hooks/policy/defaults';
import { setPluginAdsPlatforms } from '@/lib/adapters/ads/platform-registry';
import { IncompatiblePluginError } from '@/lib/plugins/errors';
import { satisfiesRange } from '@/lib/plugins/semver-range';
import { createRequire } from 'node:module';

const pkg = createRequire(import.meta.url)('../../package.json') as { version: string };
const AUTONNEL_VERSION: string = pkg.version;

function assertEngineCompatible(p: AutonnelPlugin): void {
  const range = p.engines?.autonnel;
  if (!range) return;
  if (!satisfiesRange(AUTONNEL_VERSION, range)) {
    throw new IncompatiblePluginError(p.name, range, AUTONNEL_VERSION);
  }
}

export function registerPlugins(plugins: AutonnelPlugin[]): void {
  let policyHooks: Required<PolicyHooks> = { ...DEFAULT_POLICY_HOOKS };
  const uiSlots: ActiveUiSlots = { single: {}, menuAppend: [], sidebarSystemAppend: [], navHidden: [] };
  const adsPlatforms: AdsPlatformMeta[] = [];

  for (const p of plugins) {
    assertEngineCompatible(p);

    if (p.authProvider) {
      setActiveAuthProvider(p.authProvider);
      if (p.authProvider.renderLoginExtras) registerLoginExtras(p.authProvider.renderLoginExtras);
    }

    if (p.policyHooks) policyHooks = { ...policyHooks, ...p.policyHooks };

    if (p.uiSlots) {
      const s = p.uiSlots;
      if (s['settings.storage.replace']) uiSlots.single['settings.storage.replace'] = s['settings.storage.replace'];
      if (s['settings.domains.afterForm']) uiSlots.single['settings.domains.afterForm'] = s['settings.domains.afterForm'];
      if (s['maintenance.toggle.tooltip']) uiSlots.single['maintenance.toggle.tooltip'] = s['maintenance.toggle.tooltip'];
      if (s['topbar.org.name']) uiSlots.single['topbar.org.name'] = s['topbar.org.name'];
      if (s['settings.menu.append']) uiSlots.menuAppend.push(...s['settings.menu.append']);
      if (s['sidebar.system.append']) uiSlots.sidebarSystemAppend.push(...s['sidebar.system.append']);
      if (s['nav.hidden']) uiSlots.navHidden.push(...s['nav.hidden']);
    }

    if (p.adsPlatforms) adsPlatforms.push(...p.adsPlatforms);
  }

  setActivePolicyHooks(policyHooks);
  setActiveUiSlots(uiSlots);
  setPluginAdsPlatforms(adsPlatforms);
}
