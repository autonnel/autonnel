// Job aggregate root. Transitions: PENDING -> RUNNING -> (SUCCEEDED|FAILED|CANCELLED) and
// FAILED -> PENDING (retry). attemptCount <= maxAttempts (final failure is terminal FAILED).
// Claimable only if PENDING and runAfter elapsed; claiming sets a lease to prevent double exec.
export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type DispatchStrategy = "INLINE_WAIT_UNTIL" | "CRON_POLL";

export interface JobSnapshot {
  id: string;
  tenantId: string;
  kind: string;
  status: JobStatus;
  dispatch: DispatchStrategy;
  payload: unknown;
  result: unknown | null;
  externalRef: string | null;
  idempotencyKey: string | null;
  attemptCount: number;
  maxAttempts: number;
  runAfter: Date;
  leaseExpiry: Date | null;
  failureReason: string | null;
}

const TERMINAL: JobStatus[] = ["SUCCEEDED", "FAILED", "CANCELLED"];

export class Job {
  private constructor(private s: JobSnapshot) {}

  static rehydrate(s: JobSnapshot): Job {
    return new Job({ ...s });
  }

  snapshot(): JobSnapshot {
    return { ...this.s };
  }

  isClaimable(now: Date): boolean {
    return this.s.status === "PENDING" && this.s.runAfter.getTime() <= now.getTime();
  }

  claim(now: Date, leaseMs: number): void {
    if (!this.isClaimable(now)) throw new Error(`Job ${this.s.id} not claimable`);
    this.s.status = "RUNNING";
    this.s.attemptCount += 1;
    this.s.leaseExpiry = new Date(now.getTime() + leaseMs);
  }

  succeed(result: unknown): void {
    this.assertRunning();
    this.s.status = "SUCCEEDED";
    this.s.result = result;
    this.s.leaseExpiry = null;
  }

  // External async work still in progress: re-queue for a later poll WITHOUT consuming a
  // failure attempt (only genuine failures count toward maxAttempts). Persists the provider
  // job id in externalRef so the next poll can resume it.
  defer(externalRef: string | null, nextRunAfter: Date): void {
    this.assertRunning();
    this.s.status = "PENDING";
    this.s.runAfter = nextRunAfter;
    this.s.leaseExpiry = null;
    if (externalRef !== null) this.s.externalRef = externalRef;
    if (this.s.attemptCount > 0) this.s.attemptCount -= 1;
  }

  // Re-queue to PENDING while attempts remain; otherwise terminal FAILED (never re-queued).
  fail(reason: string, nextRunAfter: Date): void {
    this.assertRunning();
    this.s.failureReason = reason;
    this.s.leaseExpiry = null;
    if (this.s.attemptCount >= this.s.maxAttempts) {
      this.s.status = "FAILED";
    } else {
      this.s.status = "PENDING";
      this.s.runAfter = nextRunAfter;
    }
  }

  cancel(): void {
    if (TERMINAL.includes(this.s.status)) throw new Error(`Job ${this.s.id} is terminal`);
    this.s.status = "CANCELLED";
    this.s.leaseExpiry = null;
  }

  private assertRunning(): void {
    if (TERMINAL.includes(this.s.status)) throw new Error(`Job ${this.s.id} is terminal`);
    if (this.s.status !== "RUNNING") throw new Error(`Job ${this.s.id} must be RUNNING (was ${this.s.status})`);
  }
}
