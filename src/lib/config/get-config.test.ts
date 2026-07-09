import { describe, it, expect, vi, beforeEach } from "vitest";

const getSpy = vi.fn();
const setSpy = vi.fn();

vi.mock("../../composition/make-platform", () => ({
  makePlatform: () => ({
    getEffectiveConfig: { get: getSpy },
    setConfig: { set: setSpy },
  }),
}));

import { getConfig, setConfig } from "./get-config";

describe("getConfig memoization", () => {
  beforeEach(() => {
    getSpy.mockReset();
    setSpy.mockReset();
  });

  it("hits the platform only once for repeated reads of the same key in a request window", async () => {
    getSpy.mockResolvedValue("v1");
    const a = await getConfig("memo.key.a");
    const b = await getConfig("memo.key.a");
    const c = await getConfig("memo.key.a");
    expect([a, b, c]).toEqual(["v1", "v1", "v1"]);
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("caches per key independently", async () => {
    getSpy.mockResolvedValueOnce("x").mockResolvedValueOnce("y");
    expect(await getConfig("memo.key.b")).toBe("x");
    expect(await getConfig("memo.key.c")).toBe("y");
    await getConfig("memo.key.b");
    await getConfig("memo.key.c");
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it("returns envFallback when the resolved value is nullish (both fresh and cached paths)", async () => {
    getSpy.mockResolvedValue(undefined);
    expect(await getConfig("memo.key.d", "fallback")).toBe("fallback");
    expect(await getConfig("memo.key.d", "fallback")).toBe("fallback");
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("setConfig invalidates the memo so the next read re-hits the platform", async () => {
    getSpy.mockResolvedValueOnce("before").mockResolvedValueOnce("after");
    expect(await getConfig("memo.key.e")).toBe("before");
    await setConfig("memo.key.e", "after");
    expect(setSpy).toHaveBeenCalledWith("memo.key.e", "after");
    expect(await getConfig("memo.key.e")).toBe("after");
    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});
