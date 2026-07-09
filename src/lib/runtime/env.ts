// A request/cron binds env via setRuntimeEnv (called from middleware/cf-worker) so adapters
// read one uniform source without importing cloudflare:workers.
//
// The bound env is pinned to a globalThis holder: autonnel-saas bundles OSS TWICE
// (published dist + source via ssr.noExternal), so this module exists as two
// instances. The cf-worker calls setRuntimeEnv on the DIST copy; source-side
// render code (the cache adapter's getBinding('CACHE_KV'), config readers) would
// otherwise read an unset SOURCE copy → "CACHE_KV binding not available" → every
// checkAuth / permission lookup silently falls back to the DB, making console
// pages DB-heavy and prone to intermittent stalls. Sharing one holder via
// globalThis makes both copies see the same env. No-op for a single-copy build.
type EnvHolder = { current?: Record<string, unknown> };
const HOLDER_KEY = Symbol.for("autonnel.runtime.env.holder");
const holder: EnvHolder = ((globalThis as typeof globalThis & { [HOLDER_KEY]?: EnvHolder })[HOLDER_KEY] ??= {});

export function setRuntimeEnv(env: Record<string, unknown> | undefined): void {
  holder.current = env;
}

export function readEnv(key: string): string | undefined {
  const cfEnv = holder.current;
  if (cfEnv && typeof cfEnv[key] === "string") return cfEnv[key] as string;
  if (typeof process !== "undefined" && process.env && key in process.env) return process.env[key];
  return undefined;
}

// The whole env record (vars + secrets + bindings). On Cloudflare this is the
// per-invocation `env` bound via setRuntimeEnv in the worker entry; in Node it
// falls back to process.env. Replaces the removed Astro v6 `locals.runtime.env`.
export function getRuntimeEnv(): Record<string, unknown> {
  if (holder.current) return holder.current;
  if (typeof process !== "undefined" && process.env) return process.env as Record<string, unknown>;
  return {};
}

export function getBinding<T = unknown>(key: string): T | undefined {
  return holder.current?.[key] as T | undefined;
}

// Must NOT depend on setRuntimeEnv: the Node middleware also calls setRuntimeEnv,
// which would otherwise make Node falsely look like Cloudflare and pick the KV adapter.
export function isCloudflareRuntime(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}
