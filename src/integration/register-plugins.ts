import type { AutonnelPlugin, AdsPlatformMeta, PolicyHooks } from '@/lib/plugins/types';
import {
  setActiveAuthProvider,
  registerLoginExtras,
  setActivePolicyHooks,
  setActiveUiSlots,
  setPluginRuntimeParts,
  type ActiveUiSlots,
  type PluginRuntimeParts,
} from '@/lib/plugins/registry';
import { DEFAULT_POLICY_HOOKS } from '@/lib/hooks/policy/defaults';
import { setPluginAdsPlatforms } from '@/lib/adapters/ads/platform-registry';
import {
  setPluginPaymentProviders,
  listPluginPaymentSlugs as previousPluginPaymentSlugs,
  type PluginPaymentProviderEntry,
} from '@/lib/plugins/payment-providers';
import { registerPaymentProvider, unregisterPaymentProvider } from '@/lib/adapters/payment/registry';
import { IncompatiblePluginError, InvalidPluginContractError } from '@/lib/plugins/errors';
import { satisfiesRange } from '@/lib/plugins/semver-range';
import { parsePluginSchema } from '@/lib/plugins/schema-extension';
import { createRequire } from 'node:module';
import { isCloudflareRuntime } from '@/lib/runtime/env';

let autonnelVersion: string | null | undefined;

// Read lazily: registerPlugins also runs inside the worker bundle, where package.json is not on
// disk. The build-time call already enforced the ranges, so the runtime call skips the check.
function readAutonnelVersion(): string | null {
  if (autonnelVersion === undefined) {
    if (isCloudflareRuntime()) return (autonnelVersion = null);
    try {
      autonnelVersion = (createRequire(import.meta.url)('../../package.json') as { version: string }).version;
    } catch {
      autonnelVersion = null;
    }
  }
  return autonnelVersion;
}

function assertEngineCompatible(p: AutonnelPlugin): void {
  const range = p.engines?.autonnel;
  if (!range) return;
  const version = readAutonnelVersion();
  if (version && !satisfiesRange(version, range)) {
    throw new IncompatiblePluginError(p.name, range, version);
  }
}

const PLUGIN_JOB_KIND_PREFIX = 'plugin.';
const PANEL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;
const PLUGIN_CRON_NAME = /^plugin\.[a-z0-9][a-z0-9.-]{0,63}$/;
const MIN_CRON_INTERVAL_MS = 60_000;

function collectCrons(p: AutonnelPlugin, parts: PluginRuntimeParts): void {
  for (const cron of p.crons ?? []) {
    if (!PLUGIN_CRON_NAME.test(cron.name)) {
      throw new InvalidPluginContractError(p.name, `cron name "${cron.name}" must match ${PLUGIN_CRON_NAME}`);
    }
    const owner = parts.crons.find((c) => c.cron.name === cron.name);
    if (owner) {
      throw new InvalidPluginContractError(p.name, `cron "${cron.name}" is already registered by ${owner.pluginName}`);
    }
    if (!Number.isInteger(cron.intervalMs) || cron.intervalMs < MIN_CRON_INTERVAL_MS) {
      throw new InvalidPluginContractError(p.name, `cron "${cron.name}" intervalMs must be an integer >= ${MIN_CRON_INTERVAL_MS}`);
    }
    parts.crons.push({ pluginName: p.name, cron });
  }
}

function collectRuntimeParts(p: AutonnelPlugin, parts: PluginRuntimeParts, menu: ActiveUiSlots['menuAppend']): void {
  if (p.onConversion) parts.conversionSubscribers.push({ pluginName: p.name, handle: p.onConversion });
  collectCrons(p, parts);
  if (p.schemaExtension) parts.models[p.name] = parsePluginSchema(p.name, p.schemaExtension).models.map((m) => m.name);

  for (const [kind, handle] of Object.entries(p.jobHandlers ?? {})) {
    if (!kind.startsWith(PLUGIN_JOB_KIND_PREFIX)) {
      throw new InvalidPluginContractError(p.name, `job kind "${kind}" must start with "${PLUGIN_JOB_KIND_PREFIX}"`);
    }
    if (parts.jobHandlers[kind]) {
      throw new InvalidPluginContractError(p.name, `job kind "${kind}" is already registered by ${parts.jobHandlers[kind].pluginName}`);
    }
    parts.jobHandlers[kind] = { pluginName: p.name, handle };
  }

  for (const panel of p.settingsPanels ?? []) {
    if (!PANEL_ID_PATTERN.test(panel.id)) {
      throw new InvalidPluginContractError(p.name, `settings panel id "${panel.id}" must match ${PANEL_ID_PATTERN}`);
    }
    if (parts.settingsPanels.some((existing) => existing.id === panel.id)) {
      throw new InvalidPluginContractError(p.name, `settings panel id "${panel.id}" is already registered`);
    }
    parts.settingsPanels.push(panel);
    menu.push({ id: `settings.plugin.${panel.id}`, label: panel.title, href: `/settings/plugins/${panel.id}` });
  }
}

const PAYMENT_SLUG = /^[A-Z][A-Z0-9_]{1,31}$/;
const BUILT_IN_PAYMENT_SLUGS = new Set(['STRIPE', 'PAYPAL']);

function collectPaymentProviders(p: AutonnelPlugin, into: Map<string, PluginPaymentProviderEntry>): void {
  for (const [slug, provider] of Object.entries(p.paymentProviders ?? {})) {
    if (BUILT_IN_PAYMENT_SLUGS.has(slug)) throw new InvalidPluginContractError(p.name, `payment provider "${slug}" is a built-in provider`);
    if (!PAYMENT_SLUG.test(slug)) throw new InvalidPluginContractError(p.name, `payment provider "${slug}" must match ${PAYMENT_SLUG}`);
    if (provider.registration.dbProvider !== slug) {
      throw new InvalidPluginContractError(p.name, `payment provider "${slug}" registration.dbProvider must equal its key`);
    }
    const owner = into.get(slug);
    if (owner) throw new InvalidPluginContractError(p.name, `payment provider "${slug}" is already registered by ${owner.pluginName}`);
    into.set(slug, { pluginName: p.name, provider });
  }
}

export function registerPlugins(plugins: AutonnelPlugin[], options: { checkEngines?: boolean } = {}): void {
  let policyHooks: Required<PolicyHooks> = { ...DEFAULT_POLICY_HOOKS };
  const uiSlots: ActiveUiSlots = { single: {}, menuAppend: [], sidebarSystemAppend: [], navHidden: [] };
  const adsPlatforms: AdsPlatformMeta[] = [];
  const runtimeParts: PluginRuntimeParts = { conversionSubscribers: [], jobHandlers: {}, settingsPanels: [], crons: [], models: {} };
  const paymentProviders = new Map<string, PluginPaymentProviderEntry>();

  for (const p of plugins) {
    if (options.checkEngines !== false) assertEngineCompatible(p);
    collectRuntimeParts(p, runtimeParts, uiSlots.menuAppend);
    collectPaymentProviders(p, paymentProviders);

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

  for (const slug of previousPluginPaymentSlugs()) if (!paymentProviders.has(slug)) unregisterPaymentProvider(slug);
  for (const entry of paymentProviders.values()) registerPaymentProvider(entry.provider.registration);
  setPluginPaymentProviders(paymentProviders);

  setActivePolicyHooks(policyHooks);
  setActiveUiSlots(uiSlots);
  setPluginAdsPlatforms(adsPlatforms);
  setPluginRuntimeParts(runtimeParts);
}
