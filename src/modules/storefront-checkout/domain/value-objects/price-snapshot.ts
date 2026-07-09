import { Money } from '@/modules/shared-kernel/money';

export class PriceSnapshot {
  private constructor(
    readonly amount: Money,
    readonly capturedAt: Date,
  ) {}

  static create(amount: Money, capturedAt: Date): PriceSnapshot {
    if (amount.amountMinor <= 0) {
      throw new Error('PriceSnapshot amount must be positive');
    }
    return new PriceSnapshot(amount, new Date(capturedAt.getTime()));
  }

  isStaleAt(now: Date, maxAgeMs: number): boolean {
    return now.getTime() - this.capturedAt.getTime() > maxAgeMs;
  }
}
