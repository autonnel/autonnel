import type { RevenueMetricsDto } from '@/lib/stats/diagnostics';

export type { RevenueMetricsDto };

export type FunnelStatsBag = Record<string, number>;

// Platform-reported counts for the same window, so the conversion funnel can start at the ad
// impression instead of at the first onsite page view. Counts only -- money is per-currency and
// belongs to the reconciliation panel, never to a summed funnel stage. Absent when no ad account
// attributes spend to this funnel in the window.
export interface FunnelAdTotalsDto {
  impressions: number;
  linkClicks: number;
  initiateCheckout: number | null;
  conversions: number;
  // Reporting zones the platform cut these days on, so the UI can disclose that the platform
  // stages and the onsite stages are not on the same calendar when they are not.
  platformTimezones: string[];
}

export interface StatsDataItemDto {
  funnelId: string;
  funnelName: string;
  stats: FunnelStatsBag;
  metrics: RevenueMetricsDto;
  ad?: FunnelAdTotalsDto;
}

export interface StatsResponseDto {
  success: boolean;
  data: StatsDataItemDto[];
  query: {
    funnelId?: string;
    startDate: string;
    endDate: string;
    timezone: string;
  };
}

export interface StatsContracts {
  'GET /api/analytics': { input: null; output: StatsResponseDto };
}
