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

  it("calls waitUntil with the execution context as receiver", () => {
    const cfContext = {
      waitUntil(this: unknown, _p: Promise<unknown>) {
        if (this !== cfContext) throw new TypeError("Illegal invocation");
      },
    };
    const adapter = new CfWaitUntilExecutionAdapter({ cfContext } as any);
    expect(() => adapter.run(async () => {})).not.toThrow();
  });

  it("falls back to fire-and-forget in Node (no cfContext)", () => {
    const adapter = new CfWaitUntilExecutionAdapter({} as any);
    const factory = vi.fn(async () => {});
    expect(() => adapter.run(factory)).not.toThrow();
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
