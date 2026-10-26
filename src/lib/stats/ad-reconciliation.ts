// Single source of truth for how a platform-reported number is compared against what this
// installation recorded. Pages render these results; they must never re-derive thresholds.
// Both numbers are always shown as reported: nothing here corrects either side.

export type DiffSeverity = 'OK' | 'WARN' | 'ALERT' | 'PLATFORM_ZERO';
export type DiffMetric = 'clicks' | 'checkoutInit' | 'conversions' | 'revenueMinor';

export const WARN_PCT = 0.15;
export const ALERT_PCT = 0.4;

// Below these absolute gaps the percentage is noise: 1 order out of 2 is 50% and means nothing.
export const MIN_ABS_DIFF: Record<DiffMetric, number> = {
  clicks: 10,
  checkoutInit: 5,
  conversions: 2,
  revenueMinor: 2000,
};

export interface DiffInput {
  metric: DiffMetric;
  platform: number;
  onsite: number;
}

export interface DiffResult {
  diff: number;
  diffPct: number | null;
  severity: DiffSeverity;
}

export function computeDiff(input: DiffInput): DiffResult {
  const diff = input.platform - input.onsite;

  if (input.platform === 0) {
    if (input.onsite === 0) return { diff: 0, diffPct: null, severity: 'OK' };
    return { diff, diffPct: null, severity: 'PLATFORM_ZERO' };
  }

  const diffPct = diff / input.platform;
  if (Math.abs(diff) < MIN_ABS_DIFF[input.metric]) return { diff, diffPct, severity: 'OK' };

  const abs = Math.abs(diffPct);
  if (abs <= WARN_PCT) return { diff, diffPct, severity: 'OK' };
  if (abs <= ALERT_PCT) return { diff, diffPct, severity: 'WARN' };
  return { diff, diffPct, severity: 'ALERT' };
}

export type ConflictReasonCode =
  | 'TIMEZONE_MISMATCH'
  | 'FAILED_POSTBACKS'
  | 'CONNECTION_EXPIRED'
  | 'UNASSIGNED_CREATIVES'
  | 'MODELED_CONVERSIONS'
  | 'REVENUE_CURRENCY_UNAVAILABLE';

export interface ConflictReason {
  code: ConflictReasonCode;
  detail: string;
}

export interface ConflictContext {
  accountTimezone: string;
  siteTimezone: string;
  // Whether the two zones are on genuinely different clocks. Optional: when absent the zone ids are
  // compared as strings, which is only safe if neither side is an Etc/GMT id -- those invert their
  // own sign (Etc/GMT+8 is UTC-8), so an operator on UTC-8 and an account on America/Los_Angeles
  // read as different ids while being the same clock for half the year.
  timezoneOffsetsDiffer?: boolean;
  failedPostbacks: number;
  connectionExpired: boolean;
  ambiguousCreatives: number;
  platformConversions: number;
  // True when this funnel has onsite orders, but none in the ad account's own reporting
  // currency for this range. Optional (defaults to no-op) so callers outside the reconciliation
  // read model that never diff revenue across currencies do not need to pass it.
  revenueCurrencyUnavailable?: boolean;
}

// Always-true methodology differences. Shown alongside the dynamic hits so a reader can tell an
// expected gap from an actual defect.
export const STATIC_CONFLICT_NOTES: readonly string[] = [
  'Platform attribution windows (for example 7-day click, 1-day view) differ from ours.',
  'Platforms deduplicate across devices and logged-in identities; we deduplicate by visitor.',
  'Platforms filter invalid clicks before reporting them.',
  'Platform conversion counts may include modeled conversions.',
];

export function detectConflictReasons(ctx: ConflictContext): ConflictReason[] {
  const reasons: ConflictReason[] = [];

  const zonesDiffer = ctx.timezoneOffsetsDiffer ?? ctx.accountTimezone !== ctx.siteTimezone;
  if (ctx.accountTimezone && ctx.siteTimezone && zonesDiffer) {
    reasons.push({
      code: 'TIMEZONE_MISMATCH',
      detail: `Ad account reports in ${ctx.accountTimezone}; this site aggregates in ${ctx.siteTimezone}. The onsite figures on this row were re-bucketed into ${ctx.accountTimezone} so both sides cover the same days, which means they will not match the site-wide dashboard for the same picked range.`,
    });
  }

  if (ctx.failedPostbacks > 0) {
    reasons.push({
      code: 'FAILED_POSTBACKS',
      detail: `${ctx.failedPostbacks} conversion postback(s) failed in this range. Those conversions never reached the platform.`,
    });
  }

  if (ctx.connectionExpired) {
    reasons.push({
      code: 'CONNECTION_EXPIRED',
      detail: 'This ad account connection needs to be reconnected; its numbers are stale.',
    });
  }

  if (ctx.ambiguousCreatives > 0) {
    reasons.push({
      code: 'UNASSIGNED_CREATIVES',
      detail: `${ctx.ambiguousCreatives} creative(s) are not assigned to a funnel, so platform spend and clicks are undercounted here.`,
    });
  }

  if (ctx.revenueCurrencyUnavailable) {
    reasons.push({
      code: 'REVENUE_CURRENCY_UNAVAILABLE',
      detail:
        "This funnel has onsite orders, but none in the ad account's own reporting currency for this range. Revenue is not compared, to avoid mixing currencies.",
    });
  }

  if (!Number.isInteger(ctx.platformConversions)) {
    reasons.push({
      code: 'MODELED_CONVERSIONS',
      detail: 'The platform returned a fractional conversion count, which means modeled conversions are included.',
    });
  }

  return reasons;
}
