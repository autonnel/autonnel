import type { PluginPaymentProvider } from './types';

export interface PluginPaymentProviderEntry {
  pluginName: string;
  provider: PluginPaymentProvider;
}

const KEY = Symbol.for('autonnel.plugins.paymentProviders');

function store(): Map<string, PluginPaymentProviderEntry> {
  const g = globalThis as unknown as { [k: symbol]: Map<string, PluginPaymentProviderEntry> | undefined };
  return (g[KEY] ??= new Map());
}

export function setPluginPaymentProviders(entries: Map<string, PluginPaymentProviderEntry>): void {
  const s = store();
  s.clear();
  for (const [slug, entry] of entries) s.set(slug, entry);
}

export function getPluginPaymentProvider(slug: string): PluginPaymentProviderEntry | undefined {
  return store().get(slug);
}

export function listPluginPaymentSlugs(): string[] {
  return [...store().keys()];
}
