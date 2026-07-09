import { describe, it, expect } from 'vitest';
import { FrequencyCapPolicy, QuietHoursPolicy, StopConditionSet } from './policies';

describe('Recall policies', () => {
  it('FrequencyCapPolicy caps total fired touches', () => {
    const cap = FrequencyCapPolicy.of({ maxTouches: 3, perWindowHours: 168 });
    expect(cap.allows(2)).toBe(true);
    expect(cap.allows(3)).toBe(false);
  });

  it('QuietHoursPolicy detects a time inside the quiet window', () => {
    // 22:00 -> 08:00 UTC quiet window
    const q = QuietHoursPolicy.of({ startHourUtc: 22, endHourUtc: 8 });
    expect(q.isQuiet(new Date('2026-06-04T23:30:00Z'))).toBe(true);
    expect(q.isQuiet(new Date('2026-06-04T12:00:00Z'))).toBe(false);
    expect(q.isQuiet(new Date('2026-06-04T07:59:00Z'))).toBe(true);
  });

  it('QuietHoursPolicy with no window never defers', () => {
    expect(QuietHoursPolicy.none().isQuiet(new Date())).toBe(false);
  });

  it('StopConditionSet always stops on paid', () => {
    const s = StopConditionSet.of({ stopOnOptout: true, stopOnBounce: false });
    expect(s.stopOnPaid).toBe(true);
    expect(s.stopOnOptout).toBe(true);
    expect(s.stopOnBounce).toBe(false);
  });
});
