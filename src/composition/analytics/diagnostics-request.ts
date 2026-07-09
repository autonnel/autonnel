import { convertDateRangeToUtc } from '@/lib/utils';
import type { DiagnosticsRange } from '@/composition/analytics/make-diagnostics';
import type { DiagnosticsQueryEcho, SegmentDimension } from '@/contracts/analytics-diagnostics';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 30;

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export class FunnelIdRequiredError extends Error {
  constructor() {
    super('funnelId query parameter is required');
    this.name = 'FunnelIdRequiredError';
  }
}

export interface ParsedDiagnosticsRequest {
  range: DiagnosticsRange;
  echo: DiagnosticsQueryEcho;
}

export function parseDiagnosticsRequest(query: URLSearchParams): ParsedDiagnosticsRequest {
  const funnelId = query.get('funnelId');
  if (!funnelId) throw new FunnelIdRequiredError();

  const now = new Date();
  const endStr = query.get('endDate') || isoDate(now);
  const startStr = query.get('startDate') || isoDate(new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * DAY_MS));
  const timezone = query.get('timezone') || 'UTC';

  const { startDate, endDate } = convertDateRangeToUtc(startStr, endStr, timezone);

  return {
    range: { funnelId, from: startDate, to: endDate },
    echo: { funnelId, startDate: startDate.toISOString(), endDate: endDate.toISOString(), timezone },
  };
}

export function resolveSegmentDimension(value: string | null): SegmentDimension {
  return value === 'campaign' ? 'campaign' : 'channel';
}
