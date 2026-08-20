// pg MUST be bundled (static import is fine — workerd validates the eager static graph; pg is bundled, not dynamic-guarded).
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readEnv, getBinding } from "./runtime/env";

interface HyperdriveBinding {
  connectionString: string;
}

// Per-request client cache. Workers forbids reusing a DB socket across requests,
// so on Cloudflare each request gets its own client (the fetch/scheduled entry
// opens a scope via runWithRequestDb and disposes it after). In Node there is no
// scope and the module singleton is reused.
export interface RequestDb {
  base?: PrismaClient;
  tenant?: unknown;
}

// Pin both singletons to globalThis so Vite's dev HMR reusing this module does not mint a fresh
// PrismaClient (leaking a new connection pool per edit) or a duplicate store. No-op in prod/Workers.
type GlobalDb = typeof globalThis & {
  __autonnelRequestDb?: AsyncLocalStorage<RequestDb>;
  __autonnelModuleClient?: PrismaClient;
};
const requestDbStore = ((globalThis as GlobalDb).__autonnelRequestDb ??= new AsyncLocalStorage<RequestDb>());

// On Cloudflare the DB goes through the Hyperdrive binding (pooling + the
// connection string it mints); DATABASE_URL is the Node/local fallback only.
function resolveConnectionString(): string {
  const hyperdrive = getBinding<HyperdriveBinding>("HYPERDRIVE");
  if (hyperdrive?.connectionString) return hyperdrive.connectionString;
  const databaseUrl = readEnv("DATABASE_URL");
  if (databaseUrl) return databaseUrl;
  throw new Error("No database connection configured (HYPERDRIVE binding or DATABASE_URL)");
}

export function isHyperdrivePool(): boolean {
  return !!getBinding<HyperdriveBinding>("HYPERDRIVE");
}

// Worker-side pg pool size against Hyperdrive. Shared by createClient's adapter config and
// dbAll's concurrency cap so the two can never drift apart.
export const HYPERDRIVE_POOL_SIZE = 5;

// Callers pass thunks (not started promises) so we can cap how many run at once on Hyperdrive:
// a fan-out wider than HYPERDRIVE_POOL_SIZE would otherwise starve itself, with the extra
// thunks queuing on connectionTimeoutMillis until they time out. Off Hyperdrive (Node's
// default 10-connection pool) there is no cap and every thunk runs concurrently.
export async function dbAll<T extends readonly (() => Promise<unknown>)[]>(
  tasks: [...T],
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  if (!isHyperdrivePool()) {
    return Promise.all(tasks.map((task) => task())) as Promise<{
      -readonly [K in keyof T]: Awaited<ReturnType<T[K]>>;
    }>;
  }

  const results: unknown[] = new Array(tasks.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }
  const workerCount = Math.min(HYPERDRIVE_POOL_SIZE, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
}

function createClient(): PrismaClient {
  // pg's default pool (max 10, connectionTimeoutMillis 0) exceeds Workers' ~6-connection
  // per-request limit on concurrent external connections: a render firing concurrent queries
  // opened extra connections, acquiring them through Hyperdrive intermittently stalled, and
  // waiting forever the Worker was killed at ~30s (the intermittent page 500/timeouts).
  // max:5 is Cloudflare's own documented driver pool size for a Worker-side pg pool against
  // Hyperdrive. connectionTimeoutMillis fails an acquire fast instead of hanging until the
  // Worker is killed. Node keeps the default pool (one long-lived client, many requests).
  const onHyperdrive = !!getBinding<HyperdriveBinding>("HYPERDRIVE");
  const adapter = new PrismaPg(
    onHyperdrive
      ? {
          connectionString: resolveConnectionString(),
          max: HYPERDRIVE_POOL_SIZE,
          connectionTimeoutMillis: 20000,
        }
      : { connectionString: resolveConnectionString() },
  );
  return new PrismaClient({ adapter });
}

export function getBasePrisma(): PrismaClient {
  const store = requestDbStore.getStore();
  if (store) return (store.base ??= createClient());
  return ((globalThis as GlobalDb).__autonnelModuleClient ??= createClient());
}

// A self-managed client NOT tied to the request scope. Long-lived streaming responses (SSE) outlive
// the fetch handler, after which runWithRequestDb's scope exits and disposeRequestDb() disconnects the
// request client — so a stream must mint and dispose its own short-lived client per poll. Caller owns
// $disconnect().
export function createStandalonePrisma(): PrismaClient {
  return createClient();
}

export function getRequestDb(): RequestDb | undefined {
  return requestDbStore.getStore();
}

export function runWithRequestDb<T>(fn: () => T): T {
  return requestDbStore.run({}, fn);
}

export async function disposeRequestDb(): Promise<void> {
  const store = requestDbStore.getStore();
  const base = store?.base;
  if (!base) return;
  store.base = undefined;
  store.tenant = undefined;
  await base.$disconnect().catch(() => {});
}
