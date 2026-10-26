import { describe, it, expect, beforeEach } from 'vitest';
import { registerPlugins } from '@/integration/register-plugins';
import { getPluginPaymentProvider } from './payment-providers';
import { getProviderByDbKey } from '@/lib/adapters/payment/registry';
import type { AutonnelPlugin, PluginPaymentProvider } from './types';

function provider(dbProvider: string): PluginPaymentProvider {
  return {
    registration: {
      paymentMethod: dbProvider.toLowerCase(), dbProvider,
      eventTypes: { clickEvents: [], successEvents: [], errorEvent: `${dbProvider}_ERROR` },
      display: { label: dbProvider, badgeClass: '' }, displayName: dbProvider,
      formFields: [], details: {}, statsColumns: [],
    },
    create: () => ({}) as never,
  };
}

const plugin = (name: string, slug: string): AutonnelPlugin => ({ name, version: '0.0.0', paymentProviders: { [slug]: provider(slug) } });

describe('plugin payment providers', () => {
  beforeEach(() => registerPlugins([], { checkEngines: false }));

  it('registers runtime and settings entries under the slug', () => {
    registerPlugins([plugin('p-acme', 'ACME')], { checkEngines: false });
    expect(getPluginPaymentProvider('ACME')?.pluginName).toBe('p-acme');
    expect(getProviderByDbKey('ACME')?.displayName).toBe('ACME');
  });

  it('rejects built-in, malformed, mismatched and duplicate slugs', () => {
    expect(() => registerPlugins([plugin('a', 'STRIPE')], { checkEngines: false })).toThrow(/built-in/);
    expect(() => registerPlugins([plugin('a', 'acme')], { checkEngines: false })).toThrow(/must match/);
    const mismatched: AutonnelPlugin = { name: 'a', version: '0', paymentProviders: { ACME: provider('OTHER') } };
    expect(() => registerPlugins([mismatched], { checkEngines: false })).toThrow(/dbProvider/);
    expect(() => registerPlugins([plugin('a', 'ACME'), plugin('b', 'ACME')], { checkEngines: false })).toThrow(/already registered/);
  });

  it('drops providers of plugins that are no longer registered', () => {
    registerPlugins([plugin('p-acme', 'ACME')], { checkEngines: false });
    registerPlugins([], { checkEngines: false });
    expect(getPluginPaymentProvider('ACME')).toBeUndefined();
  });
});
