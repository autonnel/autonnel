import { describe, it, expect, vi, beforeEach } from 'vitest';

const enqueue = vi.fn(async () => ({ jobId: 'j1', deduped: false }));
const registered = new Map<string, (payload: unknown, ctx: unknown) => Promise<unknown>>();
const findMany = vi.fn();

vi.mock('./make-platform', () => ({
  makePlatform: () => ({ enqueueJob: { enqueue } }),
  registerJobHandler: (kind: string, handler: (payload: unknown, ctx: unknown) => Promise<unknown>) => {
    if (!registered.has(kind)) registered.set(kind, handler);
  },
}));
vi.mock('../lib/db', () => ({ getBasePrisma: () => ({ userActivityEvent: { findMany } }) }));
vi.mock('../lib/config/get-config', () => ({ getConfig: vi.fn(async () => ({ on: true })) }));
vi.mock('../lib/utils/safe-url', () => ({ safeFetch: vi.fn(async () => new Response('ok')) }));

const heartbeatDelegate = { findMany: vi.fn(async () => [{ id: 'h1' }]) };
vi.mock('../modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => ({ pluginHeartbeat: heartbeatDelegate }),
}));

const cacheStore = new Map<string, { value: unknown; ttl?: number }>();
vi.mock('../lib/adapters/cache', () => ({
  getCache: () => ({
    get: async (k: string) => (cacheStore.has(k) ? cacheStore.get(k)!.value : null),
    set: async (k: string, value: unknown, ttl?: number) => { cacheStore.set(k, { value, ttl }); },
    delete: async (k: string) => { cacheStore.delete(k); },
  }),
}));
let tenant = 't1';
vi.mock('../lib/tenant/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/tenant/context')>()),
  getCurrentTenantId: () => tenant,
}));
const providerConfig = vi.fn(async (slug: string) => ({ slug, secret: 'plain' }));
vi.mock('../modules/payments/infra/config/tenant-config.adapter', () => ({
  AppConfigTenantConfigAdapter: class { providerConfig = providerConfig; },
}));

const sweeps: Array<{ name: string; schedule: unknown }> = [];
vi.mock('../lib/cron/run-sweep', () => ({
  runSweep: vi.fn(async (name: string, fn: () => Promise<unknown>, schedule: unknown) => {
    sweeps.push({ name, schedule });
    try {
      return await fn();
    } catch {
      return undefined;
    }
  }),
}));

import { registerPlugins } from '../integration/register-plugins';
import { resetUiAndPolicyRegistry } from '../lib/plugins/registry';
import type { PluginConversion } from '../lib/plugins/types';
import { setPluginPaymentProviders } from '../lib/plugins/payment-providers';
import {
  dispatchPluginConversion,
  hasConversionSubscribers,
  loadVisitedUrls,
  makePluginRuntime,
  registerPluginJobHandlers,
  runPluginCrons,
} from './plugin-runtime';

const conversion: PluginConversion = {
  kind: 'purchase',
  conversionId: 'S1',
  saleRef: 'S1',
  amountMinor: 100,
  currencyCode: 'USD',
  visitedUrls: [],
  occurredAt: '2026-09-28T00:00:00.000Z',
};

describe('plugin runtime', () => {
  beforeEach(() => {
    resetUiAndPolicyRegistry();
    registered.clear();
    enqueue.mockClear();
    findMany.mockReset();
    sweeps.length = 0;
  });

  it('reports no subscribers when no plugin listens', async () => {
    expect(hasConversionSubscribers()).toBe(false);
    await expect(dispatchPluginConversion(conversion)).resolves.toBeUndefined();
  });

  it('hands each subscriber a runtime whose enqueueJob reaches the core queue', async () => {
    registerPlugins([
      {
        name: 'p',
        version: '1.0.0',
        jobHandlers: { 'plugin.p.send': async () => null },
        onConversion: async (c, rt) => {
          expect(await rt.getConfig('p.config')).toEqual({ on: true });
          await rt.enqueueJob('plugin.p.send', `p:${c.conversionId}`, { label: 'x' });
        },
      },
    ]);

    await dispatchPluginConversion(conversion);

    expect(registered.has('plugin.p.send')).toBe(true);
    expect(enqueue).toHaveBeenCalledWith({ kind: 'plugin.p.send', idempotencyKey: 'p:S1', payload: { label: 'x' }, maxAttempts: 12 });
  });

  it('runs every subscriber and rethrows when any failed so delivery is retried', async () => {
    const second = vi.fn(async () => {});
    registerPlugins([
      { name: 'bad', version: '1.0.0', onConversion: async () => { throw new Error('boom'); } },
      { name: 'good', version: '1.0.0', onConversion: second },
    ]);

    await expect(dispatchPluginConversion(conversion)).rejects.toThrow(/1 plugin conversion subscriber/);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('wraps plugin job handlers so they receive the payload and a runtime', async () => {
    const handle = vi.fn(async (payload: unknown, rt: { fetch: (u: string) => Promise<Response> }) => {
      const res = await rt.fetch('https://t.example.com');
      return { payload, status: res.status };
    });
    registerPlugins([{ name: 'p', version: '1.0.0', jobHandlers: { 'plugin.p.send': handle as never } }]);
    registerPluginJobHandlers();

    const result = await registered.get('plugin.p.send')!({ a: 1 }, { jobId: 'j', tenantId: 't', externalRef: null });
    expect(result).toEqual({ payload: { a: 1 }, status: 200 });
  });

  it('returns deduplicated visited urls newest first and skips the query without a visitor', async () => {
    findMany.mockResolvedValue([{ url: 'https://a/2' }, { url: 'https://a/1' }, { url: 'https://a/2' }]);
    expect(await loadVisitedUrls('t', 'v1')).toEqual(['https://a/2', 'https://a/1']);
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { tenantId: 't', visitorId: 'v1' }, orderBy: { occurredAt: 'desc' } });

    expect(await loadVisitedUrls('t', undefined)).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('gives a plugin the tenant-scoped delegate of a model it declared, and nothing else', async () => {
    const schemaExtension = 'model PluginHeartbeat {\n  id String @id\n  tenantId String\n  missing Int\n}\nmodel PluginGhost {\n  id String @id\n  tenantId String\n}\n';
    registerPlugins([{ name: 'hb', version: '1.0.0', schemaExtension }]);
    const rt = makePluginRuntime('hb');

    expect(await rt.model('PluginHeartbeat').findMany()).toEqual([{ id: 'h1' }]);
    expect(() => rt.model('Job')).toThrow(/did not declare model Job/);
    expect(() => makePluginRuntime('other').model('PluginHeartbeat')).toThrow(/did not declare/);
    expect(() => rt.model('PluginGhost')).toThrow(/missing from the Prisma client/);
  });

  it('runs each plugin cron as its own sweep with its declared schedule, isolating failures', async () => {
    const good = vi.fn(async (rt: { logger: unknown }) => void rt.logger);
    registerPlugins([
      {
        name: 'p',
        version: '1.0.0',
        crons: [
          { name: 'plugin.p.fail', intervalMs: 300_000, run: async () => { throw new Error('boom'); } },
          { name: 'plugin.p.ok', intervalMs: 600_000, lockTtlSeconds: 30, run: good as never },
        ],
      },
    ]);

    expect(await runPluginCrons()).toBe(1);
    expect(good).toHaveBeenCalledTimes(1);
    expect(sweeps).toEqual([
      { name: 'plugin.p.fail', schedule: { intervalMs: 300_000, lockTtlSeconds: 300 } },
      { name: 'plugin.p.ok', schedule: { intervalMs: 600_000, lockTtlSeconds: 30 } },
    ]);
  });

  it('runs nothing when no plugin declares a cron', async () => {
    expect(await runPluginCrons()).toBe(0);
    expect(sweeps).toEqual([]);
  });

  it('runs plugin crons only on the */5 invocation of a coinciding minute', async () => {
    const run = vi.fn(async () => {});
    registerPlugins([{ name: 'p', version: '1.0.0', crons: [{ name: 'plugin.p.tick', intervalMs: 300_000, run }] }]);

    expect(await runPluginCrons('*/10 * * * *')).toBe(0);
    expect(await runPluginCrons('*/30 * * * *')).toBe(0);
    expect(run).not.toHaveBeenCalled();
    expect(await runPluginCrons('*/5 * * * *')).toBe(1);
    expect(await runPluginCrons()).toBe(1);
    expect(run).toHaveBeenCalledTimes(2);
  });
});


describe('plugin runtime cache and payment config', () => {
  beforeEach(() => {
    cacheStore.clear();
    tenant = 't1';
    providerConfig.mockClear();
    setPluginPaymentProviders(new Map([['ACME', { pluginName: 'p-acme', provider: {} as never }]]));
  });

  it('scopes cache keys by plugin and tenant', async () => {
    await makePluginRuntime('p-a').cache.set('k', { v: 1 }, 120);
    expect(cacheStore.get('plugin:p-a:t1:k')).toEqual({ value: { v: 1 }, ttl: 120 });
    expect(await makePluginRuntime('p-a').cache.get('k')).toEqual({ v: 1 });
    expect(await makePluginRuntime('p-b').cache.get('k')).toBeNull();
    tenant = 't2';
    expect(await makePluginRuntime('p-a').cache.get('k')).toBeNull();
    tenant = 't1';
    await makePluginRuntime('p-a').cache.delete('k');
    expect(cacheStore.has('plugin:p-a:t1:k')).toBe(false);
  });

  it('returns the decrypted config of the plugin own payment provider', async () => {
    expect(await makePluginRuntime('p-acme').paymentConfig('ACME')).toEqual({ slug: 'ACME', secret: 'plain' });
  });

  it('refuses payment config of another plugin or a built-in provider', async () => {
    await expect(makePluginRuntime('p-other').paymentConfig('ACME')).rejects.toThrow(/not registered by plugin p-other/);
    await expect(makePluginRuntime('p-acme').paymentConfig('STRIPE')).rejects.toThrow(/not registered by plugin p-acme/);
    expect(providerConfig).not.toHaveBeenCalled();
  });
});
