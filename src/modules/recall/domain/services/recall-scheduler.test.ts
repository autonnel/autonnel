import { describe, it, expect } from 'vitest';
import { RecallScheduler } from './recall-scheduler';
import type { ClockPort } from '../ports';

const fixedClock = (iso: string): ClockPort => ({ now: () => new Date(iso) });

const campaign = {
  recallWindowHours: 168,
  steps: [
    { stepIndex: 0, channel: 'email' as const, delayOffsetMinutes: 60, templateKey: 'recall.abandoned_checkout' },
    { stepIndex: 1, channel: 'email' as const, delayOffsetMinutes: 1440, templateKey: 'recall.abandoned_checkout' },
  ],
};

describe('RecallScheduler', () => {
  it('schedules the next step at enrolledAt + offset', () => {
    const s = new RecallScheduler(fixedClock('2026-06-04T10:00:00Z'));
    const due = s.nextDueTouch({
      enrolledAt: new Date('2026-06-04T09:00:00Z'),
      nextStepIndex: 0,
      campaign,
      quietHours: null,
      firedCount: 0,
      frequencyCapMaxTouches: 3,
    });
    expect(due.decision).toBe('fire');
    expect(due.scheduledFor?.toISOString()).toBe('2026-06-04T10:00:00.000Z');
  });

  it('defers a Touch that falls inside quiet hours', () => {
    const s = new RecallScheduler(fixedClock('2026-06-04T23:30:00Z'));
    const due = s.nextDueTouch({
      enrolledAt: new Date('2026-06-04T22:30:00Z'),
      nextStepIndex: 0,
      campaign,
      quietHours: { startHourUtc: 22, endHourUtc: 8 },
      firedCount: 0,
      frequencyCapMaxTouches: 3,
    });
    expect(due.decision).toBe('defer');
    expect(due.scheduledFor?.getUTCHours()).toBe(8);
  });

  it('goes cold when there is no next step', () => {
    const s = new RecallScheduler(fixedClock('2026-06-11T10:00:00Z'));
    const due = s.nextDueTouch({
      enrolledAt: new Date('2026-06-04T09:00:00Z'),
      nextStepIndex: 2, // past the last step
      campaign,
      quietHours: null,
      firedCount: 2,
      frequencyCapMaxTouches: 3,
    });
    expect(due.decision).toBe('cold');
  });

  it('skips (cold) when the deferred time exceeds the recall window', () => {
    const s = new RecallScheduler(fixedClock('2026-06-11T07:00:00Z'));
    const due = s.nextDueTouch({
      enrolledAt: new Date('2026-06-04T06:00:00Z'),
      nextStepIndex: 1, // offset 1440 -> due 2026-06-05T06:00, but window ends 2026-06-11T06:00
      campaign: { ...campaign, recallWindowHours: 1 },
      quietHours: null,
      firedCount: 1,
      frequencyCapMaxTouches: 3,
    });
    expect(due.decision).toBe('cold');
  });

  it('stops firing once the frequency cap is hit', () => {
    const s = new RecallScheduler(fixedClock('2026-06-04T10:00:00Z'));
    const due = s.nextDueTouch({
      enrolledAt: new Date('2026-06-04T09:00:00Z'),
      nextStepIndex: 0,
      campaign,
      quietHours: null,
      firedCount: 3,
      frequencyCapMaxTouches: 3,
    });
    expect(due.decision).toBe('cold');
  });
});
