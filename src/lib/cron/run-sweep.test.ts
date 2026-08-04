import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CacheAdapter } from "@/lib/adapters/cache";
import { setCache } from "@/lib/adapters/cache";
import { runSweep } from "./run-sweep";

function fakeCache(): CacheAdapter & {
  acquireLock: ReturnType<typeof vi.fn>;
  releaseLock: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    deletePattern: vi.fn(async () => {}),
    has: vi.fn(async () => false),
    acquireLock: vi.fn(async () => true),
    releaseLock: vi.fn(async () => {}),
  } as never;
}

describe("runSweep", () => {
  let cache: ReturnType<typeof fakeCache>;

  beforeEach(() => {
    cache = fakeCache();
    setCache(cache);
  });

  it("swallows a thrown sweep and returns undefined (error isolation)", async () => {
    const result = await runSweep("fulfillment.sync", async () => {
      throw new Error("poison record");
    });
    expect(result).toBeUndefined();
  });

  it("acquires and releases the lock for a cataloged sweep", async () => {
    const result = await runSweep("fulfillment.sync", async () => 42);
    expect(result).toBe(42);
    expect(cache.acquireLock).toHaveBeenCalledWith("cron:lock:fulfillment.sync", 7200);
    expect(cache.releaseLock).toHaveBeenCalledWith("cron:lock:fulfillment.sync");
  });

  it("releases the lock even when the sweep throws", async () => {
    await runSweep("fulfillment.sync", async () => {
      throw new Error("boom");
    });
    expect(cache.releaseLock).toHaveBeenCalledWith("cron:lock:fulfillment.sync");
  });

  it("skips the sweep and does not run fn when the lock is already held", async () => {
    cache.acquireLock.mockResolvedValueOnce(false);
    const fn = vi.fn(async () => "ran");
    const result = await runSweep("fulfillment.sync", fn);
    expect(result).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
    expect(cache.releaseLock).not.toHaveBeenCalled();
  });

  it("runs an uncataloged sweep unlocked but error-isolated", async () => {
    const result = await runSweep("jobs.poll", async () => 7);
    expect(result).toBe(7);
    expect(cache.acquireLock).not.toHaveBeenCalled();
    expect(cache.releaseLock).not.toHaveBeenCalled();
  });
});

describe("runSweep — interval gating", () => {
  // The scheduled handler runs every sweep on every invocation and the trigger list is the union
  // of all jobs' cron expressions, so the interval marker is what makes a declared schedule real.
  const store = new Map<string, unknown>();

  function intervalCache(): CacheAdapter {
    return {
      get: vi.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
      set: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
      delete: vi.fn(async (k: string) => void store.delete(k)),
      deletePattern: vi.fn(async () => {}),
      has: vi.fn(async () => false),
      acquireLock: vi.fn(async () => true),
      releaseLock: vi.fn(async () => {}),
    } as never;
  }

  beforeEach(() => {
    store.clear();
    setCache(intervalCache());
  });

  it("runs the first time and suppresses an immediate second tick", async () => {
    const fn = vi.fn(async () => "ok");
    expect(await runSweep("commerce.catalog-sync", fn)).toBe("ok");
    expect(await runSweep("commerce.catalog-sync", fn)).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs again once the interval has elapsed", async () => {
    const fn = vi.fn(async () => "ok");
    await runSweep("commerce.catalog-sync", fn);
    // 30 min interval: pretend the marker was written 31 minutes ago.
    store.set("cron:last:commerce.catalog-sync", Date.now() - 31 * 60_000);
    expect(await runSweep("commerce.catalog-sync", fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("tolerates a tick that arrives slightly early rather than halving the frequency", async () => {
    const fn = vi.fn(async () => "ok");
    await runSweep("email.dispatch", fn); // 5 min interval
    // Tick lands 200ms before the nominal boundary; it must still run.
    store.set("cron:last:email.dispatch", Date.now() - (5 * 60_000 - 200));
    expect(await runSweep("email.dispatch", fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stamps the marker before running so a throwing sweep still backs off", async () => {
    const boom = vi.fn(async () => {
      throw new Error("upstream down");
    });
    expect(await runSweep("commerce.catalog-sync", boom)).toBeUndefined();
    expect(await runSweep("commerce.catalog-sync", boom)).toBeUndefined();
    expect(boom).toHaveBeenCalledTimes(1);
  });

  it("leaves an unregistered sweep ungated", async () => {
    const fn = vi.fn(async () => "ok");
    expect(await runSweep("not.in.catalog", fn)).toBe("ok");
    expect(await runSweep("not.in.catalog", fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
