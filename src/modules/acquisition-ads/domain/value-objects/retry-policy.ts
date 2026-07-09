export class RetryPolicy {
  private constructor(
    readonly baseDelayMs: number,
    readonly factor: number,
    readonly maxAttempts: number,
    readonly jitterRatio: number,
  ) {}

  static default(): RetryPolicy {
    return new RetryPolicy(60_000, 3, 6, 0.2);
  }

  computeNextDelayMs(attempt: number, rand: () => number = Math.random): number {
    const raw = this.baseDelayMs * this.factor ** (attempt - 1);
    const jitter = raw * this.jitterRatio * rand();
    return Math.round(raw + jitter);
  }

  isExhausted(attemptCount: number): boolean {
    return attemptCount >= this.maxAttempts;
  }
}
