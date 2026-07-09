// Pure transforms for the funnel diagnostics endpoints. No I/O — each function takes already-loaded
// rows and shapes them. DB access lives in composition/analytics; these stay unit-testable.

export interface SegmentRow {
  key: string;
  label: string;
  visitors: number;
  orders: number;
  revenueMinor: number;
  convertingVisitors: number;
}

export interface SegmentDto {
  key: string;
  label: string;
  visitors: number;
  orders: number;
  revenue: number;
  cvr: number | null;
}

export const SEGMENT_TOP_N = 10;
export const OTHER_SEGMENT_KEY = '__other__';

// CVR is a true rate: converting visitors / entering visitors, so it is always <= 100%.
// orders/visitors is NOT a rate (a visitor can place multiple orders) and can exceed 100%.
export function conversionRate(convertingVisitors: number, visitors: number): number | null {
  return visitors > 0 ? (convertingVisitors / visitors) * 100 : null;
}

function toSegmentDto(row: SegmentRow): SegmentDto {
  return {
    key: row.key,
    label: row.label,
    visitors: row.visitors,
    orders: row.orders,
    revenue: row.revenueMinor / 100,
    cvr: conversionRate(row.convertingVisitors, row.visitors),
  };
}

// Top-N by visitors, remainder folded into a single "Other" bucket (omitted when empty).
export function topNWithOther(rows: SegmentRow[], topN: number = SEGMENT_TOP_N): SegmentDto[] {
  const sorted = [...rows].sort((a, b) => b.visitors - a.visitors);
  const head = sorted.slice(0, topN);
  const tail = sorted.slice(topN);

  const result = head.map(toSegmentDto);
  if (tail.length > 0) {
    const other = tail.reduce<SegmentRow>(
      (acc, r) => ({
        ...acc,
        visitors: acc.visitors + r.visitors,
        orders: acc.orders + r.orders,
        revenueMinor: acc.revenueMinor + r.revenueMinor,
        convertingVisitors: acc.convertingVisitors + r.convertingVisitors,
      }),
      { key: OTHER_SEGMENT_KEY, label: 'Other', visitors: 0, orders: 0, revenueMinor: 0, convertingVisitors: 0 },
    );
    result.push(toSegmentDto(other));
  }
  return result;
}

export interface TrendBucketRow {
  bucketStart: string;
  visitors: number;
  completed: number;
  revenueMinor: number;
}

export interface TrendPointDto {
  t: string;
  visitors: number;
  completed: number;
  revenue: number;
}

export type TrendGranularity = 'hour' | 'day';

export const TREND_MAX_POINTS = 180;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Hourly when the range is small enough to be useful at that resolution, daily otherwise.
export function pickGranularity(from: Date, to: Date): TrendGranularity {
  return to.getTime() - from.getTime() <= SEVEN_DAYS_MS ? 'hour' : 'day';
}

function dayBucketStart(iso: string): string {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// Rollup buckets are hourly ISO strings. Collapse to daily when requested, then hard-cap the point
// count by keeping only the most recent TREND_MAX_POINTS (older points are dropped, not merged, so
// the recent end stays at full fidelity).
export function downsampleTrend(
  rows: TrendBucketRow[],
  granularity: TrendGranularity,
  maxPoints: number = TREND_MAX_POINTS,
): TrendPointDto[] {
  const merged = new Map<string, TrendBucketRow>();
  for (const row of rows) {
    const bucket = granularity === 'day' ? dayBucketStart(row.bucketStart) : row.bucketStart;
    const prev = merged.get(bucket);
    if (prev) {
      prev.visitors += row.visitors;
      prev.completed += row.completed;
      prev.revenueMinor += row.revenueMinor;
    } else {
      merged.set(bucket, {
        bucketStart: bucket,
        visitors: row.visitors,
        completed: row.completed,
        revenueMinor: row.revenueMinor,
      });
    }
  }

  const ordered = [...merged.values()].sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));
  const capped = ordered.length > maxPoints ? ordered.slice(ordered.length - maxPoints) : ordered;
  return capped.map((r) => ({
    t: r.bucketStart,
    visitors: r.visitors,
    completed: r.completed,
    revenue: r.revenueMinor / 100,
  }));
}

export interface PeriodTotals {
  visitors: number;
  orders: number;
  revenueMinor: number;
  convertingVisitors: number;
}

export interface PeriodWindowDto {
  visitors: number;
  orders: number;
  revenue: number;
  cvr: number | null;
}

export interface PeriodComparisonDto {
  current: PeriodWindowDto;
  previous: PeriodWindowDto;
  delta: {
    visitorsPct: number | null;
    ordersPct: number | null;
    revenuePct: number | null;
    cvrPct: number | null;
  };
}

function toWindow(totals: PeriodTotals): PeriodWindowDto {
  return {
    visitors: totals.visitors,
    orders: totals.orders,
    revenue: totals.revenueMinor / 100,
    cvr: conversionRate(totals.convertingVisitors, totals.visitors),
  };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function buildPeriodComparison(current: PeriodTotals, previous: PeriodTotals): PeriodComparisonDto {
  const cur = toWindow(current);
  const prev = toWindow(previous);
  return {
    current: cur,
    previous: prev,
    delta: {
      visitorsPct: pctChange(cur.visitors, prev.visitors),
      ordersPct: pctChange(cur.orders, prev.orders),
      revenuePct: pctChange(cur.revenue, prev.revenue),
      cvrPct: cur.cvr !== null && prev.cvr !== null ? pctChange(cur.cvr, prev.cvr) : null,
    },
  };
}

// Previous equal-length window immediately preceding [from, to).
export function previousWindow(from: Date, to: Date): { from: Date; to: Date } {
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: new Date(from.getTime()) };
}

export interface RevenueMetricsDto {
  revenue: number;
  orders: number;
  visitors: number;
  aov: number | null;
  rpv: number | null;
}

export function buildRevenueMetrics(input: {
  revenueMinor: number;
  orders: number;
  visitors: number;
}): RevenueMetricsDto {
  const revenue = input.revenueMinor / 100;
  return {
    revenue,
    orders: input.orders,
    visitors: input.visitors,
    aov: input.orders > 0 ? revenue / input.orders : null,
    rpv: input.visitors > 0 ? revenue / input.visitors : null,
  };
}
