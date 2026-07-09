import { describe, it, expect, vi, afterEach } from "vitest";
import { createLogger } from "./logger";

describe("createLogger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits one JSON line per call with module, level, message, meta", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("Platform");
    log.info("job enqueued", { jobId: "j1" });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.module).toBe("Platform");
    expect(line.level).toBe("info");
    expect(line.message).toBe("job enqueued");
    expect(line.jobId).toBe("j1");
    expect(typeof line.timestamp).toBe("string");
  });

  it("extracts Error message/name/stack from meta.error", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger("Platform").error("boom", { error: new Error("nope") });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.error.message).toBe("nope");
    expect(line.error.name).toBe("Error");
  });

  it("child appends a sub-module segment", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger("CronJob").child("outbox").info("drain");
    expect(JSON.parse(spy.mock.calls[0][0] as string).module).toBe("CronJob:outbox");
  });
});
