export interface RetryScheduleInput {
  baseDelaySeconds: number;
  maxAttempts: number;
  maxDelaySeconds?: number;
}

export class RetrySchedule {
  private constructor(
    readonly baseDelaySeconds: number,
    readonly maxAttempts: number,
    readonly maxDelaySeconds: number,
  ) {}

  static of(input: RetryScheduleInput): RetrySchedule {
    if (input.baseDelaySeconds <= 0) throw new Error('baseDelaySeconds must be > 0');
    if (input.maxAttempts <= 0) throw new Error('maxAttempts must be > 0');
    return new RetrySchedule(input.baseDelaySeconds, input.maxAttempts, input.maxDelaySeconds ?? 24 * 3600);
  }

  computeNext(attemptCount: number, now: Date): Date | null {
    if (attemptCount >= this.maxAttempts) return null;
    const delay = Math.min(this.baseDelaySeconds * 2 ** (attemptCount - 1), this.maxDelaySeconds);
    return new Date(now.getTime() + delay * 1000);
  }
}
