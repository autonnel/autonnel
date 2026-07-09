import { convertDateRangeToUtc } from '@/lib/utils';
import { DEFAULT_TIMEZONE } from '@/lib/constants/timezone';

export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'default';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type AnalyticsRange = '24h' | '7d' | '30d' | 'custom';

export interface AnalyticsWindow {
  range: AnalyticsRange;
  tz: string;
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  bucketCount: number;
  bucketMs: number;
  label: string;
  shortLabel: string;
  startDateStr: string;
  endDateStr: string;
}

const PRESET_DAYS: Record<'24h' | '7d' | '30d', number> = { '24h': 1, '7d': 7, '30d': 30 };

function isValidDateStr(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

export function isoDateInTz(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

// Resolve the dashboard time window from query params: explicit start+end dates (calendar range in the
// chosen timezone) take precedence over a preset (24h/7d/30d rolling window ending now). prevStart/prevEnd
// is the equal-length window immediately before, used for the period-over-period deltas.
export function resolveAnalyticsWindow(input: {
  range?: string | null;
  start?: string | null;
  end?: string | null;
  tz?: string | null;
  now?: Date;
}): AnalyticsWindow {
  const now = input.now ?? new Date();
  const tz = input.tz || DEFAULT_TIMEZONE;

  if (isValidDateStr(input.start) && isValidDateStr(input.end)) {
    const { startDate, endDate } = convertDateRangeToUtc(input.start, input.end, tz);
    const start = startDate;
    const end = endDate.getTime() >= startDate.getTime() ? endDate : new Date(startDate.getTime() + DAY_MS);
    const durationMs = Math.max(HOUR_MS, end.getTime() - start.getTime());
    const daily = durationMs > 2 * DAY_MS;
    const bucketMs = daily ? DAY_MS : HOUR_MS;
    const bucketCount = Math.min(daily ? 92 : 48, Math.max(1, Math.ceil(durationMs / bucketMs)));
    return {
      range: 'custom',
      tz,
      start,
      end,
      prevStart: new Date(start.getTime() - durationMs),
      prevEnd: start,
      bucketCount,
      bucketMs,
      label: `${input.start} – ${input.end}`,
      shortLabel: 'custom range',
      startDateStr: input.start,
      endDateStr: input.end,
    };
  }

  const range: '24h' | '7d' | '30d' = input.range === '7d' || input.range === '30d' ? input.range : '24h';
  const days = PRESET_DAYS[range];
  const start = new Date(now.getTime() - days * DAY_MS);
  const bucketMs = range === '24h' ? HOUR_MS : DAY_MS;
  const bucketCount = range === '24h' ? 24 : days;
  const label = range === '24h' ? 'last 24 hours' : range === '7d' ? 'last 7 days' : 'last 30 days';
  return {
    range,
    tz,
    start,
    end: now,
    prevStart: new Date(start.getTime() - days * DAY_MS),
    prevEnd: start,
    bucketCount,
    bucketMs,
    label,
    shortLabel: range,
    startDateStr: isoDateInTz(start, tz),
    endDateStr: isoDateInTz(now, tz),
  };
}

export interface AnalyticsKpi {
  visits24h: number;
  visitsPrev24h: number;
  conversionRate24h: number;
  conversionRatePrev24h: number;
  orders24h: number;
  ordersPrev24h: number;
  revenue24h: number;
  revenuePrev24h: number;
}

export interface AggregateAnalyticsInput {
  visits: Array<{ createdAt: Date | string }>;
  orders: Array<{ paidAt: Date | string | null; status?: string; totalUSD?: number | string | null }>;
  now?: Date;
  window?: { start: number; end: number; prevStart: number; prevEnd: number };
}

export function aggregateAnalyticsKpi(input: AggregateAnalyticsInput): AnalyticsKpi {
  const now = input.now ?? new Date();
  const w = input.window ?? {
    start: now.getTime() - DAY_MS,
    end: now.getTime(),
    prevStart: now.getTime() - 2 * DAY_MS,
    prevEnd: now.getTime() - DAY_MS,
  };

  let visits24 = 0;
  let visitsPrev = 0;
  for (const v of input.visits) {
    const ts = typeof v.createdAt === 'string' ? new Date(v.createdAt).getTime() : v.createdAt.getTime();
    if (ts >= w.start && ts <= w.end) visits24++;
    else if (ts >= w.prevStart && ts < w.prevEnd) visitsPrev++;
  }

  let orders24 = 0;
  let ordersPrev = 0;
  let revenue24 = 0;
  let revenuePrev = 0;
  for (const o of input.orders) {
    if (!o.paidAt) continue;
    const ts = typeof o.paidAt === 'string' ? new Date(o.paidAt).getTime() : o.paidAt.getTime();
    const amt = o.totalUSD == null ? 0 : (typeof o.totalUSD === 'string' ? parseFloat(o.totalUSD) : o.totalUSD);
    const safeAmt = isFinite(amt) ? amt : 0;
    if (ts >= w.start && ts <= w.end) {
      orders24++;
      revenue24 += safeAmt;
    } else if (ts >= w.prevStart && ts < w.prevEnd) {
      ordersPrev++;
      revenuePrev += safeAmt;
    }
  }

  return {
    visits24h: visits24,
    visitsPrev24h: visitsPrev,
    orders24h: orders24,
    ordersPrev24h: ordersPrev,
    revenue24h: revenue24,
    revenuePrev24h: revenuePrev,
    conversionRate24h: conversionRate(orders24, visits24),
    conversionRatePrev24h: conversionRate(ordersPrev, visitsPrev),
  };
}

export function conversionRate(orders: number, visits: number): number {
  if (visits <= 0) return 0;
  return (orders / visits) * 100;
}

export interface FunnelStepInput {
  visits: Array<{ pageType: string | null; eventType?: string | null }>;
}

export interface FunnelStepRow {
  key: string;
  label: string;
  count: number;
  dropRate: number;
}

const STEP_DEFS: Array<{ key: string; label: string; matchPageType: string[]; matchEventType?: string[] }> = [
  { key: 'lp1',       label: 'LP1 (Landing)',  matchPageType: ['LANDING', 'LP1', 'lp1', 'landing'] },
  { key: 'lp2',       label: 'LP2',            matchPageType: ['LP2', 'lp2'] },
  { key: 'lp3',       label: 'LP3',            matchPageType: ['LP3', 'lp3'] },
  { key: 'checkout',  label: 'Checkout',       matchPageType: ['CHECKOUT', 'checkout'] },
  { key: 'upsell',    label: 'Upsell',         matchPageType: ['UPSELL', 'upsell', 'UPSELL1', 'UPSELL2', 'UPSELL3'] },
  { key: 'thankyou',  label: 'Thank you',      matchPageType: ['THANKYOU', 'thankyou'] },
];

// dropEmpty hides steps with no page views (e.g. unused LP2/LP3 template slots) and recomputes drop
// rates over only the visible steps, so the remaining percentages stay relative to the prior shown step.
export function aggregateFunnelSteps(input: FunnelStepInput, opts: { dropEmpty?: boolean } = {}): FunnelStepRow[] {
  const counts = new Map<string, number>();
  for (const def of STEP_DEFS) counts.set(def.key, 0);

  for (const v of input.visits) {
    const t = (v.pageType || '').toString();
    if (!t) continue;
    for (const def of STEP_DEFS) {
      if (def.matchPageType.includes(t)) {
        counts.set(def.key, (counts.get(def.key) ?? 0) + 1);
        break;
      }
    }
  }

  const defs = opts.dropEmpty ? STEP_DEFS.filter((def) => (counts.get(def.key) ?? 0) > 0) : STEP_DEFS;

  const rows: FunnelStepRow[] = [];
  let prev: number | null = null;
  for (const def of defs) {
    const c = counts.get(def.key) ?? 0;
    let drop = 0;
    if (prev !== null && prev > 0) drop = Math.max(0, ((prev - c) / prev) * 100);
    rows.push({ key: def.key, label: def.label, count: c, dropRate: drop });
    prev = c;
  }
  return rows;
}

export interface MethodStatsInput {
  orders: Array<{
    paymentMethod: string | null;
    status: string;
    totalUSD?: number | string | null;
  }>;
}

export interface MethodStatsRow {
  method: string;
  label: string;
  submits: number;
  successes: number;
  failures: number;
  successRate: number;
  revenue: number;
}

const METHOD_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  card:   'Card (Stripe)',
  stripe: 'Stripe',
};

export function aggregateMethodStats(input: MethodStatsInput): MethodStatsRow[] {
  const map = new Map<string, MethodStatsRow>();
  for (const o of input.orders) {
    const key = (o.paymentMethod || 'other').toLowerCase();
    let row = map.get(key);
    if (!row) {
      row = {
        method: key,
        label: METHOD_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1),
        submits: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        revenue: 0,
      };
      map.set(key, row);
    }
    row.submits++;
    if (o.status === 'PAID' || o.status === 'SHIPPED' || o.status === 'DELIVERED') {
      row.successes++;
      const amt = o.totalUSD == null ? 0 : (typeof o.totalUSD === 'string' ? parseFloat(o.totalUSD) : o.totalUSD);
      if (isFinite(amt)) row.revenue += amt;
    } else if (o.status === 'CANCELLED' || o.status === 'FAILED') {
      row.failures++;
    }
  }
  for (const row of map.values()) {
    row.successRate = row.submits > 0 ? (row.successes / row.submits) * 100 : 0;
  }
  return Array.from(map.values()).sort((a, b) => b.submits - a.submits);
}

export interface TrafficSourceInput {
  visits: Array<{ trafficSource?: string | null; urlParams?: Record<string, any> | null }>;
  orders: Array<{ trafficSource?: string | null; totalUSD?: number | string | null; status: string }>;
}

export interface TrafficSourceRow {
  source: string;
  label: string;
  visits: number;
  orders: number;
  revenue: number;
}

const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK:    'Facebook',
  TIKTOK:      'TikTok',
  GOOGLE_ADS:  'Google Ads',
  GOOGLE:      'Google',
  BING_ADS:    'Bing Ads',
  ORGANIC:     'Organic',
  DIRECT:      'Direct',
  UNKNOWN:     'Unknown',
};

export function deriveTrafficSource(
  trafficSource: string | null | undefined,
  urlParams: Record<string, any> | null | undefined,
): string {
  if (trafficSource && trafficSource.length > 0) return trafficSource.toUpperCase();
  if (urlParams) {
    if (urlParams.fbclid) return 'FACEBOOK';
    if (urlParams.ttclid) return 'TIKTOK';
    if (urlParams.gclid) return 'GOOGLE_ADS';
    if (urlParams.msclkid) return 'BING_ADS';
    if (urlParams.utm_source) return String(urlParams.utm_source).toUpperCase();
  }
  return 'UNKNOWN';
}

export function aggregateTrafficSources(input: TrafficSourceInput): TrafficSourceRow[] {
  const map = new Map<string, TrafficSourceRow>();
  function ensure(src: string): TrafficSourceRow {
    let r = map.get(src);
    if (!r) {
      r = { source: src, label: SOURCE_LABELS[src] || src, visits: 0, orders: 0, revenue: 0 };
      map.set(src, r);
    }
    return r;
  }
  for (const v of input.visits) {
    const src = deriveTrafficSource(v.trafficSource ?? null, v.urlParams ?? null);
    ensure(src).visits++;
  }
  for (const o of input.orders) {
    if (o.status !== 'PAID' && o.status !== 'SHIPPED' && o.status !== 'DELIVERED') continue;
    const src = deriveTrafficSource(o.trafficSource ?? null, null);
    const r = ensure(src);
    r.orders++;
    const amt = o.totalUSD == null ? 0 : (typeof o.totalUSD === 'string' ? parseFloat(o.totalUSD) : o.totalUSD);
    if (isFinite(amt)) r.revenue += amt;
  }
  return Array.from(map.values()).sort((a, b) => b.visits - a.visits);
}

export function statusBadgeClasses(tone: Tone): string {
  switch (tone) {
    case 'ok':   return 'bg-ds-okBg border-ds-okBorder text-ds-okText';
    case 'warn': return 'bg-ds-warnBg border-ds-warnBorder text-ds-warnText';
    case 'bad':  return 'bg-ds-badBg border-ds-badBorder text-ds-badText';
    case 'muted': return 'bg-ds-surface2 border-ds-line text-ds-muted';
    default:     return 'bg-ds-surface2 border-ds-line text-ds-slate';
  }
}

export function formatPercent(pct: number, fractionDigits = 2): string {
  if (!isFinite(pct)) return '0.00%';
  return `${pct.toFixed(fractionDigits)}%`;
}

export function formatMoney(amount: number | string | null | undefined, currency = 'USD'): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (!isFinite(n)) return '$0.00';
  const fixed = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (currency === 'USD') return `$${fixed}`;
  return `${fixed} ${currency}`;
}
