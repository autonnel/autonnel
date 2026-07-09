import { describe, it, expect } from 'vitest';
import {
  topNWithOther,
  downsampleTrend,
  pickGranularity,
  buildPeriodComparison,
  previousWindow,
  buildRevenueMetrics,
  conversionRate,
  OTHER_SEGMENT_KEY,
  TREND_MAX_POINTS,
  type SegmentRow,
  type TrendBucketRow,
} from './diagnostics';

describe('conversionRate', () => {
  it('is converting/entering visitors as a percentage', () => {
    expect(conversionRate(2, 5)).toBe(40);
    expect(conversionRate(5, 5)).toBe(100);
  });

  it('never exceeds 100% (converting is capped at entering by construction)', () => {
    expect(conversionRate(5, 5)).toBeLessThanOrEqual(100);
  });

  it('returns null when there are no entering visitors', () => {
    expect(conversionRate(0, 0)).toBeNull();
  });
});

describe('topNWithOther', () => {
  const seg = (
    key: string,
    visitors: number,
    orders = 0,
    revenueMinor = 0,
    convertingVisitors = 0,
  ): SegmentRow => ({
    key,
    label: key,
    visitors,
    orders,
    revenueMinor,
    convertingVisitors,
  });

  it('sorts by visitors descending and computes cvr (converting/visitors) + revenue in major units', () => {
    const out = topNWithOther([seg('a', 100, 10, 50000, 10), seg('b', 200, 40, 80000, 40)]);
    expect(out.map((s) => s.key)).toEqual(['b', 'a']);
    expect(out[0]).toMatchObject({ key: 'b', visitors: 200, orders: 40, revenue: 800, cvr: 20 });
    expect(out[1]).toMatchObject({ key: 'a', cvr: 10, revenue: 500 });
  });

  it('keeps cvr <= 100% even when a visitor places multiple orders (orders > visitors)', () => {
    // 5 entering visitors, 2 converting, 11 orders -> cvr 40%, not 220%.
    const out = topNWithOther([seg('chan', 5, 11, 33888, 2)]);
    expect(out[0]).toMatchObject({ visitors: 5, orders: 11, revenue: 338.88, cvr: 40 });
  });

  it('folds the tail beyond N into a single Other bucket summing visitors/orders/revenue/converting', () => {
    // s0..s12 have visitors 100..88; top-10 keeps 100..91, tail is 90,89,88.
    const rows = Array.from({ length: 13 }, (_, i) => seg(`s${i}`, 100 - i, 1, 1000, 1));
    const out = topNWithOther(rows, 10);
    expect(out).toHaveLength(11);
    const other = out[out.length - 1];
    expect(other.key).toBe(OTHER_SEGMENT_KEY);
    expect(other.label).toBe('Other');
    expect(other.visitors).toBe(90 + 89 + 88);
    expect(other.orders).toBe(3);
    expect(other.revenue).toBe(30);
    // 3 converting / (90+89+88) entering
    expect(other.cvr).toBe((3 / (90 + 89 + 88)) * 100);
  });

  it('Other bucket aggregates exactly the rows past the top-N', () => {
    const rows = [seg('a', 10), seg('b', 9), seg('c', 8), seg('d', 7)];
    const out = topNWithOther(rows, 2);
    expect(out.map((s) => s.key)).toEqual(['a', 'b', OTHER_SEGMENT_KEY]);
    expect(out[2].visitors).toBe(8 + 7);
  });

  it('omits the Other bucket when there is no tail', () => {
    const out = topNWithOther([seg('a', 10), seg('b', 5)], 10);
    expect(out.some((s) => s.key === OTHER_SEGMENT_KEY)).toBe(false);
  });

  it('returns cvr null when a segment has zero visitors', () => {
    const out = topNWithOther([seg('a', 0, 0, 0, 0)]);
    expect(out[0].cvr).toBeNull();
  });

  it('returns an empty array for no input', () => {
    expect(topNWithOther([])).toEqual([]);
  });
});

describe('pickGranularity', () => {
  it('uses hourly buckets for ranges <= 7 days', () => {
    const from = new Date('2026-06-01T00:00:00Z');
    const to = new Date('2026-06-08T00:00:00Z');
    expect(pickGranularity(from, to)).toBe('hour');
  });

  it('uses daily buckets for ranges > 7 days', () => {
    const from = new Date('2026-06-01T00:00:00Z');
    const to = new Date('2026-06-20T00:00:00Z');
    expect(pickGranularity(from, to)).toBe('day');
  });
});

describe('downsampleTrend', () => {
  const hourly = (h: number, visitors: number, completed = 0, revenueMinor = 0): TrendBucketRow => ({
    bucketStart: `2026-06-01T${String(h).padStart(2, '0')}:00:00.000Z`,
    visitors,
    completed,
    revenueMinor,
  });

  it('keeps hourly points untouched (revenue converted to major units), sorted ascending', () => {
    const out = downsampleTrend([hourly(3, 5, 2, 2500), hourly(1, 9, 1, 1000)], 'hour');
    expect(out.map((p) => p.t)).toEqual([
      '2026-06-01T01:00:00.000Z',
      '2026-06-01T03:00:00.000Z',
    ]);
    expect(out[0]).toMatchObject({ visitors: 9, completed: 1, revenue: 10 });
    expect(out[1].revenue).toBe(25);
  });

  it('collapses hourly buckets into daily buckets summing each metric', () => {
    const rows = [
      hourly(0, 10, 5, 1000),
      hourly(5, 20, 8, 2000),
      hourly(23, 30, 10, 3000),
    ];
    const out = downsampleTrend(rows, 'day');
    expect(out).toHaveLength(1);
    expect(out[0].t).toBe('2026-06-01T00:00:00.000Z');
    expect(out[0]).toMatchObject({ visitors: 60, completed: 23, revenue: 60 });
  });

  it('hard-caps the number of returned points, keeping the most recent', () => {
    const rows: TrendBucketRow[] = Array.from({ length: TREND_MAX_POINTS + 50 }, (_, i) => {
      const d = new Date('2026-01-01T00:00:00.000Z');
      d.setUTCDate(d.getUTCDate() + i);
      return { bucketStart: d.toISOString(), visitors: i, completed: 0, revenueMinor: 0 };
    });
    const out = downsampleTrend(rows, 'day');
    expect(out).toHaveLength(TREND_MAX_POINTS);
    // most recent kept: last point should be the highest visitors value (i = total-1)
    expect(out[out.length - 1].visitors).toBe(TREND_MAX_POINTS + 50 - 1);
    // oldest dropped: first kept point is index 50
    expect(out[0].visitors).toBe(50);
  });

  it('returns empty for no buckets', () => {
    expect(downsampleTrend([], 'hour')).toEqual([]);
  });
});

describe('previousWindow', () => {
  it('returns the equal-length window immediately preceding the range', () => {
    const from = new Date('2026-06-08T00:00:00.000Z');
    const to = new Date('2026-06-15T00:00:00.000Z');
    const prev = previousWindow(from, to);
    expect(prev.to.toISOString()).toBe('2026-06-08T00:00:00.000Z');
    expect(prev.from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(prev.to.getTime() - prev.from.getTime()).toBe(to.getTime() - from.getTime());
  });
});

describe('buildPeriodComparison', () => {
  it('computes current/previous windows and percentage deltas with cvr = converting/visitors', () => {
    const out = buildPeriodComparison(
      { visitors: 200, orders: 30, revenueMinor: 100000, convertingVisitors: 20 },
      { visitors: 100, orders: 8, revenueMinor: 50000, convertingVisitors: 5 },
    );
    expect(out.current).toMatchObject({ visitors: 200, orders: 30, revenue: 1000, cvr: 10 });
    expect(out.previous).toMatchObject({ visitors: 100, orders: 8, revenue: 500, cvr: 5 });
    expect(out.delta.visitorsPct).toBe(100);
    expect(out.delta.ordersPct).toBe(275);
    expect(out.delta.revenuePct).toBe(100);
    expect(out.delta.cvrPct).toBe(100);
  });

  it('keeps cvr <= 100% even when orders exceed visitors', () => {
    const out = buildPeriodComparison(
      { visitors: 5, orders: 11, revenueMinor: 33888, convertingVisitors: 2 },
      { visitors: 0, orders: 0, revenueMinor: 0, convertingVisitors: 0 },
    );
    expect(out.current.cvr).toBe(40);
    expect(out.current.cvr).toBeLessThanOrEqual(100);
  });

  it('returns null delta when previous is zero and current is non-zero', () => {
    const out = buildPeriodComparison(
      { visitors: 50, orders: 5, revenueMinor: 1000, convertingVisitors: 5 },
      { visitors: 0, orders: 0, revenueMinor: 0, convertingVisitors: 0 },
    );
    expect(out.delta.visitorsPct).toBeNull();
    expect(out.delta.ordersPct).toBeNull();
    expect(out.delta.revenuePct).toBeNull();
    // previous cvr is null -> cvrPct null
    expect(out.delta.cvrPct).toBeNull();
  });

  it('returns zero delta when both windows are zero', () => {
    const out = buildPeriodComparison(
      { visitors: 0, orders: 0, revenueMinor: 0, convertingVisitors: 0 },
      { visitors: 0, orders: 0, revenueMinor: 0, convertingVisitors: 0 },
    );
    expect(out.delta.visitorsPct).toBe(0);
    expect(out.current.cvr).toBeNull();
  });
});

describe('buildRevenueMetrics', () => {
  it('computes AOV and RPV in major units', () => {
    const out = buildRevenueMetrics({ revenueMinor: 100000, orders: 20, visitors: 500 });
    expect(out).toMatchObject({ revenue: 1000, orders: 20, visitors: 500, aov: 50, rpv: 2 });
  });

  it('returns null AOV when there are no orders and null RPV when no visitors', () => {
    expect(buildRevenueMetrics({ revenueMinor: 0, orders: 0, visitors: 100 }).aov).toBeNull();
    expect(buildRevenueMetrics({ revenueMinor: 5000, orders: 1, visitors: 0 }).rpv).toBeNull();
  });
});
