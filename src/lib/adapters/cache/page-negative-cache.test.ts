import { describe, it, expect, beforeEach } from "vitest";
import {
  setCache,
  CACHE_TTL,
  withJitter,
  getPageMissFromCache,
  setPageMissInCache,
  invalidatePageCache,
} from "./index";
import { MemoryCacheAdapter } from "./memory";

describe("page negative cache", () => {
  beforeEach(() => {
    setCache(new MemoryCacheAdapter());
  });

  it("reports a miss only after it is recorded", async () => {
    expect(await getPageMissFromCache("default", "/ghost")).toBe(false);
    await setPageMissInCache("default", "/ghost");
    expect(await getPageMissFromCache("default", "/ghost")).toBe(true);
  });

  it("isolates miss markers per tenant and per slug", async () => {
    await setPageMissInCache("default", "/ghost");
    expect(await getPageMissFromCache("other", "/ghost")).toBe(false);
    expect(await getPageMissFromCache("default", "/other-slug")).toBe(false);
  });

  it("invalidatePageCache clears the negative marker for that slug", async () => {
    await setPageMissInCache("default", "/ghost");
    await invalidatePageCache("default", "page_1", "/ghost");
    expect(await getPageMissFromCache("default", "/ghost")).toBe(false);
  });
});

describe("withJitter", () => {
  it("stays within +/-10% of the base TTL", () => {
    for (let i = 0; i < 1000; i++) {
      const j = withJitter(CACHE_TTL.PAGE);
      expect(j).toBeGreaterThanOrEqual(Math.round(CACHE_TTL.PAGE * 0.9));
      expect(j).toBeLessThanOrEqual(Math.round(CACHE_TTL.PAGE * 1.1));
    }
  });

  it("produces a spread of values (not a constant)", () => {
    const values = new Set(Array.from({ length: 50 }, () => withJitter(CACHE_TTL.PAGE)));
    expect(values.size).toBeGreaterThan(1);
  });
});
