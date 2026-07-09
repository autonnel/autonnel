import type { RecallAttempt } from '../recall-attempt';

export interface AttributionResult {
  recovered: boolean;
  attributedTouchId: string | null;
}

export class RecoveryAttributor {
  attribute(attempt: RecallAttempt, recoveredAt: Date, attributionWindowHours: number): AttributionResult {
    const windowMs = attributionWindowHours * 3_600_000;
    const fired = attempt.touches
      .filter((t) => t.firedAt !== null)
      .sort((a, b) => (b.firedAt as Date).getTime() - (a.firedAt as Date).getTime());
    const last = fired[0];
    if (!last || !last.firedAt) return { recovered: true, attributedTouchId: null };
    const within = recoveredAt.getTime() - last.firedAt.getTime() <= windowMs;
    return { recovered: true, attributedTouchId: within ? last.touchId : null };
  }
}
