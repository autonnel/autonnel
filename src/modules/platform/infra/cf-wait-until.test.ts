import { describe, it, expect, vi } from "vitest";
import { CfWaitUntilExecutionAdapter } from "./cf-wait-until";

describe("CfWaitUntilExecutionAdapter", () => {
  it("schedules via locals.cfContext.waitUntil when present", () => {
    const waitUntil = vi.fn();
    const adapter = new CfWaitUntilExecutionAdapter({ cfContext: { waitUntil } } as any);
    const factory = async () => {};
    adapter.run(factory);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("falls back to fire-and-forget in Node (no cfContext)", () => {
    const adapter = new CfWaitUntilExecutionAdapter({} as any);
    const factory = vi.fn(async () => {});
    expect(() => adapter.run(factory)).not.toThrow();
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
