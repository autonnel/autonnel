import { getCache } from "@/lib/adapters/cache";
import { createLogger } from "@/lib/logger";
import { CRON_JOBS } from "./catalog";

const log = createLogger("Cron:sweep");

const lockTtlByName = new Map(CRON_JOBS.map((j) => [j.name, j.lockTtlSeconds]));
const intervalByName = new Map(CRON_JOBS.map((j) => [j.name, j.intervalMs]));

function lockKey(name: string): string {
  return `cron:lock:${name}`;
}

function lastRunKey(name: string): string {
  return `cron:last:${name}`;
}

// A tick can arrive a few ms before its nominal boundary. Comparing against the exact interval
// would then skip that tick and silently halve the job's real frequency, so the gate allows a
// 10% early margin: it suppresses the extra ticks it is meant to, never the on-schedule one.
const INTERVAL_TOLERANCE = 0.9;

// Runs one named cron sweep with three guarantees the tick relies on:
//   - error isolation: a throw is logged and swallowed so it can't abort the rest of the tick
//   - advisory locking: the catalog `lockTtlSeconds` gates concurrent ticks off the same sweep
//   - interval gating: the catalog `intervalMs` gates how OFTEN the sweep may run
// The interval gate is what makes a sweep's declared schedule real. The scheduled handler runs
// EVERY sweep on EVERY invocation, and the trigger list is the union of all jobs' cron
// expressions, so without this a job declaring `*/30` still ran every 5 minutes because some
// other job's `*/5` trigger fired the handler. Both the lock and the marker are best-effort
// (read-then-write on KV/memory, TTL-expiring).
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
    const intervalMs = intervalByName.get(name);
    if (intervalMs) {
      const last = await cache.get<number>(lastRunKey(name));
      const sinceMs = typeof last === "number" ? Date.now() - last : Number.POSITIVE_INFINITY;
      if (sinceMs < intervalMs * INTERVAL_TOLERANCE) {
        log.info("cron sweep skipped (ran within its interval)", { sweep: name, sinceMs, intervalMs });
        return undefined;
      }
      // Stamped BEFORE the run: a slow or failing sweep must not re-fire on every tick and
      // hammer an upstream API. The next attempt comes at the next interval boundary.
      await cache.set(lastRunKey(name), Date.now(), Math.ceil(intervalMs / 1000));
    }
    return await fn();
  } catch (err) {
    log.error("cron sweep failed", { sweep: name, error: err });
    return undefined;
  } finally {
    if (locked) await cache.releaseLock(lockKey(name));
  }
}
