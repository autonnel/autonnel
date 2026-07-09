import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { PriceSnapshot } from '../value-objects/price-snapshot';
import { PriceStalenessPolicy } from './price-staleness-policy';

describe('PriceStalenessPolicy', () => {
  const policy = new PriceStalenessPolicy();
  const at = new Date('2026-06-04T00:00:00Z');
  const snap = PriceSnapshot.create(Money.of(1000, 'USD'), at);

  it('passes within the max age', () => {
    expect(() => policy.assertFresh(snap, new Date('2026-06-04T00:04:00Z'), 5 * 60_000)).not.toThrow();
  });

  it('throws beyond the max age', () => {
    expect(() => policy.assertFresh(snap, new Date('2026-06-04T00:06:00Z'), 5 * 60_000)).toThrow(/stale/i);
  });
});
