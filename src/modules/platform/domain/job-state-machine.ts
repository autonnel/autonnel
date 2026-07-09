import type { JobStatus } from "./job";

const LEGAL: Record<JobStatus, JobStatus[]> = {
  PENDING: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  FAILED: ["PENDING"],
  SUCCEEDED: [],
  CANCELLED: [],
};

export const JobStateMachine = {
  canTransition(from: JobStatus, to: JobStatus): boolean {
    return LEGAL[from].includes(to);
  },
};

export interface RetryPolicy {
  baseMs: number;
  factor: number;
  maxMs: number;
}

export class RetrySchedulingService {
  constructor(private readonly policy: RetryPolicy) {}

  nextRunAfter(attemptCount: number, now: Date): Date {
    const raw = this.policy.baseMs * Math.pow(this.policy.factor, Math.max(0, attemptCount - 1));
    return new Date(now.getTime() + Math.min(raw, this.policy.maxMs));
  }
}
