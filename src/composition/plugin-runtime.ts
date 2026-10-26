import { getBasePrisma } from '../lib/db';
import { getConfig } from '../lib/config/get-config';
import { createLogger } from '../lib/logger';
import { safeFetch } from '../lib/utils/safe-url';
import { runSweep } from '../lib/cron/run-sweep';
import { PLUGIN_CRON_TRIGGER } from '../lib/cron/catalog';
import { getConversionSubscribers, getPluginCrons, getPluginJobHandlers, getPluginModels } from '../lib/plugins/registry';
import type { PluginCache, PluginConversion, PluginModelDelegate, PluginRuntime } from '../lib/plugins/types';
import { getCache } from '../lib/adapters/cache';
import { getCurrentTenantId } from '../lib/tenant/context';
import { getPluginPaymentProvider } from '../lib/plugins/payment-providers';
import { AppConfigTenantConfigAdapter } from '../modules/payments/infra/config/tenant-config.adapter';
import type { PspSlug } from '../modules/payments/domain/value-objects';
import { getTenantPrisma } from '../modules/platform/infra/prisma-tenant-extension';
import { makePlatform, registerJobHandler } from './make-platform';

const logger = createLogger('PluginRuntime');

const PLUGIN_JOB_MAX_ATTEMPTS = 12;
const VISITED_URL_LIMIT = 50;
const VISITED_URL_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

type Locals = { cfContext?: { waitUntil(p: Promise<unknown>): void } } | undefined;

export function makePluginRuntime(pluginName: string, locals?: Locals): PluginRuntime {
  const pluginLogger = createLogger(`plugin:${pluginName}`);
  return {
    getConfig: <T>(key: string) => getConfig<T>(key),
    enqueueJob: async (kind, idempotencyKey, payload) => {
      registerPluginJobHandlers();
      await makePlatform(locals).enqueueJob.enqueue({
        kind,
        idempotencyKey,
        payload,
        maxAttempts: PLUGIN_JOB_MAX_ATTEMPTS,
      });
    },
    fetch: (url, init) =>
      safeFetch(url, {
        method: init?.method ?? 'GET',
        headers: init?.headers,
        body: init?.body,
        timeoutMs: init?.timeoutMs,
      }),
    model: (name) => pluginModel(pluginName, name),
    cache: pluginCache(pluginName),
    paymentConfig: (slug) => pluginPaymentConfig(pluginName, slug),
    logger: {
      info: (message, meta) => pluginLogger.info(message, meta),
      warn: (message, meta) => pluginLogger.warn(message, meta),
      error: (message, meta) => pluginLogger.error(message, meta),
    },
  };
}

function pluginModel(pluginName: string, name: string): PluginModelDelegate {
  if (!getPluginModels(pluginName).includes(name)) {
    throw new Error(`plugin ${pluginName} did not declare model ${name} in its schemaExtension`);
  }
  const delegate = (getTenantPrisma() as unknown as Record<string, PluginModelDelegate | undefined>)[
    name.charAt(0).toLowerCase() + name.slice(1)
  ];
  if (!delegate) {
    throw new Error(`model ${name} is missing from the Prisma client; run \`autonnel schema:compose\` and regenerate it`);
  }
  return delegate;
}

function pluginCache(pluginName: string): PluginCache {
  const scoped = (key: string) => `plugin:${pluginName}:${getCurrentTenantId()}:${key}`;
  return {
    get: (key) => getCache().get(scoped(key)),
    set: (key, value, ttlSeconds) => getCache().set(scoped(key), value, ttlSeconds),
    delete: (key) => getCache().delete(scoped(key)),
  };
}

async function pluginPaymentConfig(pluginName: string, slug: string): Promise<Record<string, string>> {
  if (getPluginPaymentProvider(slug)?.pluginName !== pluginName) {
    throw new Error(`payment provider ${slug} is not registered by plugin ${pluginName}`);
  }
  return new AppConfigTenantConfigAdapter().providerConfig(slug as PspSlug);
}

// Each cron is its own sweep: a throw is logged and isolated, and the lock plus interval marker are per cron.
// `trigger` is the cron expression of the scheduled invocation; omitted for manual / HTTP runs.
export async function runPluginCrons(trigger?: string): Promise<number> {
  if (trigger !== undefined && trigger !== PLUGIN_CRON_TRIGGER) return 0;
  let ran = 0;
  for (const { pluginName, cron } of getPluginCrons()) {
    const schedule = { intervalMs: cron.intervalMs, lockTtlSeconds: cron.lockTtlSeconds ?? Math.ceil(cron.intervalMs / 1000) };
    const done = await runSweep(cron.name, async () => {
      await cron.run(makePluginRuntime(pluginName));
      return true;
    }, schedule);
    if (done) ran++;
  }
  return ran;
}

// Idempotent; every drain entry point calls it via registerAllJobHandlers.
export function registerPluginJobHandlers(): void {
  for (const [kind, entry] of Object.entries(getPluginJobHandlers())) {
    registerJobHandler(kind, (payload) => entry.handle(payload, makePluginRuntime(entry.pluginName)));
  }
}

export async function loadVisitedUrls(tenantId: string, visitorId: string | undefined): Promise<string[]> {
  if (!visitorId) return [];
  const rows = await getBasePrisma().userActivityEvent.findMany({
    where: {
      tenantId,
      visitorId,
      url: { not: null },
      occurredAt: { gte: new Date(Date.now() - VISITED_URL_WINDOW_MS) },
    },
    orderBy: { occurredAt: 'desc' },
    take: VISITED_URL_LIMIT,
    select: { url: true },
  });
  return [...new Set(rows.map((r) => r.url).filter((u): u is string => Boolean(u)))];
}

export function hasConversionSubscribers(): boolean {
  return getConversionSubscribers().length > 0;
}

// Subscribers are expected to only enqueue idempotent jobs, so a failure here is rethrown and the
// caller's at-least-once delivery retries the whole fan-out.
export async function dispatchPluginConversion(conversion: PluginConversion, locals?: Locals): Promise<void> {
  const failures: unknown[] = [];
  for (const subscriber of getConversionSubscribers()) {
    try {
      await subscriber.handle(conversion, makePluginRuntime(subscriber.pluginName, locals));
    } catch (error) {
      logger.error('plugin conversion subscriber failed', {
        plugin: subscriber.pluginName,
        conversionId: conversion.conversionId,
        error,
      });
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} plugin conversion subscriber(s) failed for ${conversion.conversionId}`);
  }
}
