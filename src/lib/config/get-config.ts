import { makePlatform } from "../../composition/make-platform";
import { getCurrentTenantId } from "../tenant/context";

// Short-TTL read-through cache. getConfig is called many times per request (every typed accessor
// in keys.ts), each doing 2 serial DB reads (tenant + global). The TTL is far shorter than any
// request, so it collapses those repeats to one DB hit while bounding cross-process staleness;
// setConfig invalidates the exact key in-process so same-process writes are read-your-writes.
const CONFIG_MEMO_TTL_MS = 5_000;
const _configMemo = new Map<string, { value: unknown; expiresAt: number }>();

function memoKey(key: string): string {
  return `${getCurrentTenantId()}:${key}`;
}

export async function getConfig<T = unknown>(key: string, envFallback?: T): Promise<T | undefined> {
  const mk = memoKey(key);
  const cached = _configMemo.get(mk);
  if (cached && Date.now() < cached.expiresAt) {
    return (cached.value as T) ?? envFallback;
  }
  const { getEffectiveConfig } = makePlatform();
  const value = await getEffectiveConfig.get(key);
  _configMemo.set(mk, { value, expiresAt: Date.now() + CONFIG_MEMO_TTL_MS });
  return (value as T) ?? envFallback;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  const { setConfig: svc } = makePlatform();
  await svc.set(key, value);
  _configMemo.delete(memoKey(key));
}

// The platform config store is write-through with no row delete; clearing a key to null
// reads back as "unset" (getConfig falls through to envFallback), which is the behavior
// every caller of deleteConfig relies on.
export async function deleteConfig(key: string): Promise<void> {
  const { setConfig: svc } = makePlatform();
  await svc.set(key, null);
}

// Read-modify-write of a nested path inside a JSON config document. Done in JS (not
// jsonb_set) because the underlying store does not create missing intermediate containers.
export async function setConfigPath(key: string, path: string[], value: unknown): Promise<void> {
  const doc = ((await getConfig<Record<string, unknown>>(key)) as Record<string, unknown> | undefined) ?? {};
  let cursor = doc;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    const existing = cursor[segment];
    if (existing === null || typeof existing !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
  await setConfig(key, doc);
}

export async function deleteConfigPath(key: string, path: string[]): Promise<void> {
  const doc = (await getConfig<Record<string, unknown>>(key)) as Record<string, unknown> | undefined;
  if (!doc) return;
  let cursor = doc;
  for (let i = 0; i < path.length - 1; i++) {
    const next = cursor[path[i]];
    if (next === null || typeof next !== 'object') return;
    cursor = next as Record<string, unknown>;
  }
  delete cursor[path[path.length - 1]];
  await setConfig(key, doc);
}
