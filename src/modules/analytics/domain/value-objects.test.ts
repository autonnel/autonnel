import { describe, it, expect } from 'vitest';
import {
  FunnelEvent,
  ConversionStage,
  CapturedRevenue,
  VisitorId,
  TimeBucket,
  DimensionKey,
  isPastCaptureBoundary,
  conversionStageOf,
} from './value-objects';
import { Money } from '../../shared-kernel/money';

describe('FunnelEvent enum (hard-bounded at capture)', () => {
  it('exposes no refund/ship/deliver kinds — structurally cannot model post-capture lifecycle', () => {
    const kinds = Object.values(FunnelEvent);
    expect(kinds).toContain('payment_captured');
    expect(kinds).toContain('handoff_completed');
    expect(kinds).not.toContain('refunded');
    expect(kinds).not.toContain('shipped');
    expect(kinds).not.toContain('delivered');
    expect(kinds).not.toContain('partially_refunded');
  });

  it('treats any non-FunnelEvent kind as past the capture boundary', () => {
    expect(isPastCaptureBoundary('refunded')).toBe(true);
    expect(isPastCaptureBoundary('shipped')).toBe(true);
    expect(isPastCaptureBoundary(FunnelEvent.PaymentCaptured)).toBe(false);
    expect(isPastCaptureBoundary(FunnelEvent.PageView)).toBe(false);
  });
});

describe('conversionStageOf', () => {
  it('maps events to a monotonic conversion stage', () => {
    expect(conversionStageOf(FunnelEvent.PageView)).toBe(ConversionStage.Visit);
    expect(conversionStageOf(FunnelEvent.StepView)).toBe(ConversionStage.StepProgression);
    expect(conversionStageOf(FunnelEvent.CheckoutStarted)).toBe(ConversionStage.CheckoutStarted);
    expect(conversionStageOf(FunnelEvent.PaymentCaptured)).toBe(ConversionStage.PaymentCaptured);
  });
});

describe('CapturedRevenue', () => {
  it('wraps a Money and only accrues capture amounts', () => {
    const rev = CapturedRevenue.zero('USD');
    const added = rev.accrue(Money.of(1999, 'USD'));
    expect(added.toMoney().amountMinor).toBe(1999);
    expect(added.toMoney().currencyCode).toBe('USD');
  });

  it('rejects mixing currencies', () => {
    const rev = CapturedRevenue.zero('USD');
    expect(() => rev.accrue(Money.of(500, 'EUR'))).toThrow(/currency/i);
  });
});

describe('VisitorId / TimeBucket / DimensionKey', () => {
  it('VisitorId is opaque, pseudonymous, never PII', () => {
    const v = VisitorId.of('anid-abc123');
    expect(v.value).toBe('anid-abc123');
    expect(VisitorId.of('anid-abc123').equals(v)).toBe(true);
  });

  it('TimeBucket truncates to the hour in UTC', () => {
    const b = TimeBucket.hourly(new Date('2026-06-04T13:42:09.000Z'));
    expect(b.key).toBe('2026-06-04T13:00:00.000Z');
  });

  it('DimensionKey is a stable canonical string for a dimension map', () => {
    const a = DimensionKey.of({ channel: 'meta', utm: 'spring' });
    const b = DimensionKey.of({ utm: 'spring', channel: 'meta' });
    expect(a.value).toBe(b.value);
  });
});
