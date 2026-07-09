import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { apiCall, ApiCallError } from '@/lib/api/client';
import { TIMEZONE_OPTIONS } from '@/lib/constants/timezone';
import { createEmptyStats } from '@/lib/adapters/payment/stats-config.client';
import { Button as DsButton, Card as DsCard } from '../primitives/ds';
import FunnelPyramid from './FunnelPyramid';
import KpiRow from './KpiRow';
import TrendPanel from './TrendPanel';
import CheckoutFunnelPanel from './CheckoutFunnelPanel';
import PaymentHealthPanel from './PaymentHealthPanel';
import SegmentBreakdownPanel from './SegmentBreakdownPanel';
import ExperimentArmsPanel from './ExperimentArmsPanel';
import { PanelError, PanelLoading } from './PanelState';
import type { DiagnosticsFilters } from './use-diagnostics-query';
import { Input, dsSelectClass } from '@/components/primitives';
import type { RevenueMetricsDto } from '@/contracts/analytics-diagnostics';
import type { StatsResponseDto } from '@/contracts/stats';
import { cn } from '@/lib/utils';

const DEFAULT_TIMEZONE = 'Etc/GMT-8';

interface FunnelAnalyticsTabProps {
  funnelId: string;
  funnelName: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialTimezone?: string;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

const fieldLabelClass = 'text-[11.5px] font-medium text-ds-muted uppercase tracking-wide';

export default function FunnelAnalyticsTab({
  funnelId,
  initialStartDate,
  initialEndDate,
  initialTimezone,
}: FunnelAnalyticsTabProps) {
  const [startDate, setStartDate] = useState(initialStartDate || getToday());
  const [endDate, setEndDate] = useState(initialEndDate || getToday());
  const [timezone, setTimezone] = useState(initialTimezone || DEFAULT_TIMEZONE);

  // Committed filters drive every panel; editing the inputs above does not re-fetch until Refresh.
  const [filters, setFilters] = useState<DiagnosticsFilters>({
    funnelId,
    startDate: initialStartDate || getToday(),
    endDate: initialEndDate || getToday(),
    timezone: initialTimezone || DEFAULT_TIMEZONE,
    revision: 0,
  });

  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [metrics, setMetrics] = useState<RevenueMetricsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    apiCall('GET /api/analytics', null, {
      query: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        timezone: filters.timezone,
        funnelId: filters.funnelId,
      },
    })
      .then((result) => {
        if (!active) return;
        const entry = (result as StatsResponseDto).data?.find((item) => item.funnelId === funnelId);
        setStats(entry?.stats || createEmptyStats());
        setMetrics(entry?.metrics ?? null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message =
          err instanceof ApiCallError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to fetch statistics data';
        setError(message);
        setStats(null);
        setMetrics(null);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [funnelId, filters]);

  const handleRefresh = () => {
    setFilters((prev) => ({
      funnelId,
      startDate,
      endDate,
      timezone,
      revision: prev.revision + 1,
    }));
  };

  return (
    <div className="flex flex-col gap-5">
      <DsCard
        title="Filters"
        subtitle="Adjust the time range and filters to refine the conversion data."
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={fieldLabelClass} htmlFor="startDate">
              Start date
            </label>
            <Input
              id="startDate"
              type="date"
              className="w-40"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={fieldLabelClass} htmlFor="endDate">
              End date
            </label>
            <Input
              id="endDate"
              type="date"
              className="w-40"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={fieldLabelClass} htmlFor="timezone">
              Timezone
            </label>
            <select
              id="timezone"
              className={cn(dsSelectClass, 'w-64')}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <DsButton
            variant="primary"
            disabled={isLoading}
            leftIcon={
              isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )
            }
            onClick={handleRefresh}
          >
            Refresh
          </DsButton>
        </div>
      </DsCard>

      <KpiRow filters={filters} metrics={metrics} />

      <TrendPanel filters={filters} />

      {isLoading && !stats && (
        <DsCard title="Conversion funnel">
          <PanelLoading label="Loading statistics…" />
        </DsCard>
      )}
      {!isLoading && error && (
        <DsCard title="Conversion funnel">
          <PanelError message={error} />
        </DsCard>
      )}
      {!error && stats && <FunnelPyramid stats={stats} />}

      <CheckoutFunnelPanel filters={filters} />

      <PaymentHealthPanel filters={filters} />

      <SegmentBreakdownPanel filters={filters} />

      <ExperimentArmsPanel filters={filters} />
    </div>
  );
}
