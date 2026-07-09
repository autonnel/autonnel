import { describe, it, expect } from "vitest";
import { JobStateMachine, RetrySchedulingService } from "./job-state-machine";

describe("JobStateMachine", () => {
  it("permits legal transitions", () => {
    expect(JobStateMachine.canTransition("PENDING", "RUNNING")).toBe(true);
    expect(JobStateMachine.canTransition("RUNNING", "SUCCEEDED")).toBe(true);
    expect(JobStateMachine.canTransition("FAILED", "PENDING")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(JobStateMachine.canTransition("SUCCEEDED", "RUNNING")).toBe(false);
    expect(JobStateMachine.canTransition("PENDING", "SUCCEEDED")).toBe(false);
  });
});

describe("RetrySchedulingService", () => {
  it("computes exponential backoff capped at the ceiling", () => {
    const svc = new RetrySchedulingService({ baseMs: 1000, factor: 2, maxMs: 10_000 });
    const now = new Date(0);
    expect(svc.nextRunAfter(1, now).getTime()).toBe(1000);
    expect(svc.nextRunAfter(2, now).getTime()).toBe(2000);
    expect(svc.nextRunAfter(3, now).getTime()).toBe(4000);
    expect(svc.nextRunAfter(20, now).getTime()).toBe(10_000); // capped
  });
});
