import { describe, it, expect } from "vitest";
import { makePlatform, registerJobHandler } from "./make-platform";

describe("makePlatform", () => {
  it("returns wired platform services", () => {
    const p = makePlatform();
    expect(p.enqueueJob).toBeDefined();
    expect(p.runJob).toBeDefined();
    expect(p.pollPendingJobs).toBeDefined();
    expect(p.getEffectiveConfig).toBeDefined();
    expect(p.setConfig).toBeDefined();
    expect(p.eventPublisher).toBeDefined();
  });

  it("shares a single per-isolate handler registry across calls", () => {
    registerJobHandler("test.kind", async () => "ok");
    expect(makePlatform().handlerRegistry.has("test.kind")).toBe(true);
    expect(makePlatform().handlerRegistry.has("test.kind")).toBe(true);
  });
});
