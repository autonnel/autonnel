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
