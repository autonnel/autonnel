import { conversionRate } from '@/lib/stats/diagnostics';
import type { FunnelStatsBag, FunnelAdTotalsDto } from '@/contracts/stats';

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  widthPct: number;
  conversionPct: number | null;
  dropPct: number | null;
  // What the ad platform reported for the SAME step, shown beside our own number rather than
  // replacing it. Set only on the onsite stages that have a platform counterpart; the platform is
  // never allowed to overwrite a stage value, because the whole point is seeing both.
  platformValue?: number | null;
}

export interface FunnelUpsell {
  key: string;
  label: string;
  value: number;
  ofOrdersPct: number | null;
}

export interface FunnelAggregate {
  stages: FunnelStage[];
  upsells: FunnelUpsell[];
  revenue: number;
  orders: number;
  visitors: number;
  overallCvr: number | null;
  aov: number | null;
}

const firstLp = (s: FunnelStatsBag) => s.lp1 || s.lp2 || s.lp3 || 0;
const lastLp = (s: FunnelStatsBag) => s.lp3 || s.lp2 || s.lp1 || 0;

// `ad` prepends the two platform-side steps that come BEFORE anyone reaches the site, so the
// funnel reads end to end: impression -> link click -> first page -> ... -> order. Only those two
// become stages. The platform's checkout-start and conversion counts are a second measurement of
// steps we already have, not extra steps -- they ride along on their own stage as platformValue,
// because inserting them as rows would break the funnel's monotonic descent and imply a drop-off
// that never happened.
export function buildFunnel(stats: FunnelStatsBag, ad?: FunnelAdTotalsDto | null): FunnelAggregate {
  const onsiteRaw = [
    { key: 'firstLp', label: 'First Landing Page', value: firstLp(stats) },
    { key: 'lastLp', label: 'Last Landing Page', value: lastLp(stats) },
    { key: 'checkout', label: 'Checkout', value: stats.checkout || 0, platformValue: ad?.initiateCheckout ?? null },
    { key: 'payClicks', label: 'Payment Clicks', value: stats.totalUclick || 0 },
    { key: 'success', label: 'Successful Payments', value: stats.totalSuccess || 0 },
    { key: 'orders', label: 'Orders', value: stats.orders || 0, platformValue: ad ? ad.conversions : null },
  ];

  const adRaw = ad
    ? [
        { key: 'adImpressions', label: 'Ad Impressions', value: ad.impressions },
        { key: 'adLinkClicks', label: 'Ad Link Clicks', value: ad.linkClicks },
      ]
    : [];

  const raw = [...adRaw, ...onsiteRaw];

  const top = raw[0].value;
  const stages: FunnelStage[] = raw.map((stage, index) => {
    const prev = index > 0 ? raw[index - 1].value : null;
    return {
      ...stage,
      widthPct: top > 0 ? stage.value / top : 0,
      conversionPct: prev && prev > 0 ? (stage.value / prev) * 100 : null,
      dropPct: prev && prev > 0 ? (1 - stage.value / prev) * 100 : null,
    };
  });

  const orders = stats.orders || 0;
  const revenue = stats.revenue || 0;
  const upsells: FunnelUpsell[] = [
    { key: 'upsell1', label: 'Upsell 1' },
    { key: 'upsell2', label: 'Upsell 2' },
    { key: 'upsell3', label: 'Upsell 3' },
  ]
    .map((upsell) => {
      const value = stats[upsell.key] || 0;
      return { ...upsell, value, ofOrdersPct: orders > 0 ? (value / orders) * 100 : null };
    })
    .filter((upsell) => upsell.value > 0);

  // Headline Visitors/CVR use the canonical session-distinct counts (entering = distinct session
  // visitors, converting = the entering subset that ordered), so they match the KPI and segments.
  // Fall back to the first landing-page count only when the canonical field is absent (backward-safe).
  // The funnel STAGE bars above are step-progression from funnel-events and intentionally untouched.
  // The headline Visitors KPI stays an ONSITE number even when the funnel now starts at an ad
  // impression -- falling back to raw[0] here would silently report impressions as visitors.
  const entering = stats.enteringVisitors || onsiteRaw[0].value;
  const converting = Math.min(stats.convertingVisitors || 0, entering);

  return {
    stages,
    upsells,
    revenue,
    orders,
    visitors: entering,
    overallCvr: conversionRate(converting, entering),
    aov: orders > 0 ? revenue / orders : null,
  };
}
