import { getCache } from "@/lib/adapters/cache";
import { createLogger } from "@/lib/logger";
import { CRON_JOBS } from "./catalog";

const log = createLogger("Cron:sweep");

const lockTtlByName = new Map(CRON_JOBS.map((j) => [j.name, j.lockTtlSeconds]));

function lockKey(name: string): string {
  return `cron:lock:${name}`;
}

// Runs one named cron sweep with two guarantees the tick relies on:
//   - error isolation: a throw is logged and swallowed so it can't abort the rest of the tick
//   - advisory locking: the catalog `lockTtlSeconds` gates concurrent ticks off the same sweep
// The lock is best-effort (read-then-write on KV/memory, TTL-expiring); a stuck holder self-clears
// at TTL. Sweeps without a catalog entry run unlocked but still error-isolated.
export async function runSweep<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const ttl = lockTtlByName.get(name);
  const cache = getCache();
  let locked = false;
  if (ttl) {
    locked = await cache.acquireLock(lockKey(name), ttl);
    if (!locked) {
      log.info("cron sweep skipped (locked by concurrent tick)", { sweep: name });
      return undefined;
    }
  }
  try {
    return await fn();
  } catch (err) {
    log.error("cron sweep failed", { sweep: name, error: err });
    return undefined;
  } finally {
    if (locked) await cache.releaseLock(lockKey(name));
  }
}
