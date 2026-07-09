import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { PriceSnapshot } from './price-snapshot';

describe('PriceSnapshot', () => {
  it('freezes a Money amount with a capture timestamp', () => {
    const at = new Date('2026-06-04T00:00:00.000Z');
    const snap = PriceSnapshot.create(Money.of(1999, 'USD'), at);
    expect(snap.amount.amountMinor).toBe(1999);
    expect(snap.amount.currencyCode).toBe('USD');
    expect(snap.capturedAt.getTime()).toBe(at.getTime());
  });

  it('reports staleness relative to a max age', () => {
    const at = new Date('2026-06-04T00:00:00.000Z');
    const snap = PriceSnapshot.create(Money.of(1999, 'USD'), at);
    const within = new Date('2026-06-04T00:04:00.000Z');
    const beyond = new Date('2026-06-04T00:06:00.000Z');
    expect(snap.isStaleAt(within, 5 * 60_000)).toBe(false);
    expect(snap.isStaleAt(beyond, 5 * 60_000)).toBe(true);
  });

  it('rejects a non-positive amount', () => {
    expect(() => PriceSnapshot.create(Money.of(0, 'USD'), new Date())).toThrow(
      /positive/i,
    );
  });
});
