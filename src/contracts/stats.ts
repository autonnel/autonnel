import type { RevenueMetricsDto } from '@/lib/stats/diagnostics';

export type { RevenueMetricsDto };

export type FunnelStatsBag = Record<string, number>;

export interface StatsDataItemDto {
  funnelId: string;
  funnelName: string;
  stats: FunnelStatsBag;
  metrics: RevenueMetricsDto;
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
