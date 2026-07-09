import type {
  SegmentDto,
  TrendPointDto,
  TrendGranularity,
  PeriodComparisonDto,
  RevenueMetricsDto,
} from '@/lib/stats/diagnostics';

export type { SegmentDto, TrendPointDto, TrendGranularity, PeriodComparisonDto, RevenueMetricsDto };

export interface DiagnosticsQueryEcho {
  funnelId: string | null;
  startDate: string;
  endDate: string;
  timezone: string;
}

export type SegmentDimension = 'channel' | 'campaign';

export interface SegmentsResponseDto {
  success: boolean;
  dimension: SegmentDimension;
  segments: SegmentDto[];
  query: DiagnosticsQueryEcho;
}

export interface ExperimentArmDto {
  experimentId: string;
  armId: string;
  key: string;
  label: string;
  visitors: number;
  orders: number;
  revenue: number;
  cvr: number | null;
}

export interface ExperimentsResponseDto {
  success: boolean;
  arms: ExperimentArmDto[];
  query: DiagnosticsQueryEcho;
}

export interface CheckoutMicroFunnelStageDto {
  key: string;
  label: string;
  visitors: number;
}

export interface ProviderHealthDto {
  provider: string;
  attempts: number;
  successes: number;
  errors: number;
  successRate: number | null;
  errorRate: number | null;
}

export interface PaymentsResponseDto {
  success: boolean;
  microFunnel: CheckoutMicroFunnelStageDto[];
  paymentErrors: number;
  providers: ProviderHealthDto[];
  query: DiagnosticsQueryEcho;
}

export interface TrendResponseDto {
  success: boolean;
  granularity: TrendGranularity;
  points: TrendPointDto[];
  comparison: PeriodComparisonDto;
  query: DiagnosticsQueryEcho;
}

export interface AnalyticsDiagnosticsContracts {
  'GET /api/analytics/segments': { input: null; output: SegmentsResponseDto };
  'GET /api/analytics/experiments': { input: null; output: ExperimentsResponseDto };
  'GET /api/analytics/payments': { input: null; output: PaymentsResponseDto };
  'GET /api/analytics/trend': { input: null; output: TrendResponseDto };
}
