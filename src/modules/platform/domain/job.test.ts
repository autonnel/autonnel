import { describe, it, expect } from "vitest";
import { Job } from "./job";

const base = () =>
  Job.rehydrate({
    id: "j1",
    tenantId: "default",
    kind: "outbox.drain",
    status: "PENDING",
    dispatch: "CRON_POLL",
    payload: {},
    attemptCount: 0,
    maxAttempts: 3,
    runAfter: new Date(0),
    leaseExpiry: null,
    idempotencyKey: null,
    externalRef: null,
    result: null,
    failureReason: null,
  });

describe("Job aggregate", () => {
  it("is claimable when PENDING and runAfter elapsed", () => {
    expect(base().isClaimable(new Date())).toBe(true);
  });

  it("is NOT claimable before runAfter", () => {
    const j = Job.rehydrate({ ...(base() as any).snapshot(), runAfter: new Date(Date.now() + 60_000) });
    expect(j.isClaimable(new Date())).toBe(false);
  });

  it("claim sets RUNNING + leaseExpiry and increments attemptCount", () => {
    const j = base();
    j.claim(new Date(0), 30_000);
    expect(j.snapshot().status).toBe("RUNNING");
    expect(j.snapshot().attemptCount).toBe(1);
    expect(j.snapshot().leaseExpiry).toEqual(new Date(30_000));
  });

  it("succeed records result and is terminal", () => {
    const j = base();
    j.claim(new Date(0), 1000);
    j.succeed({ ok: true });
    expect(j.snapshot().status).toBe("SUCCEEDED");
    expect(() => j.succeed({})).toThrow(/terminal/i);
  });

  it("fail re-queues to PENDING while attempts remain", () => {
    const j = base();
    j.claim(new Date(0), 1000);
    j.fail("transient", new Date(0));
    expect(j.snapshot().status).toBe("PENDING");
  });

  it("fail becomes terminal FAILED at maxAttempts", () => {
    const j = Job.rehydrate({ ...(base() as any).snapshot(), attemptCount: 2, maxAttempts: 3 });
    j.claim(new Date(0), 1000);
    j.fail("permanent", new Date(0));
    expect(j.snapshot().status).toBe("FAILED");
  });

  it("rejects illegal transition (succeed before claim)", () => {
    expect(() => base().succeed({})).toThrow(/RUNNING/i);
  });
});
