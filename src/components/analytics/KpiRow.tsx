import React from 'react';
import { Card as DsCard, Stat } from '../primitives/ds';
import type { RevenueMetricsDto, TrendResponseDto } from '@/contracts/analytics-diagnostics';
import { useDiagnosticsQuery, type DiagnosticsFilters } from './use-diagnostics-query';
import { PanelError } from './PanelState';
import {
  countText,
  moneyText,
  percentText,
  signedPercentText,
  deltaDirection,
  deltaTone,
} from './format';

interface KpiRowProps {
  filters: DiagnosticsFilters;
  metrics: RevenueMetricsDto | null;
}

const PREVIOUS_LABEL = 'vs previous';

function KpiSkeleton() {
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2" aria-hidden="true">
          <div className="h-3 w-16 animate-pulse rounded bg-ds-surface2" />
          <div className="h-7 w-20 animate-pulse rounded bg-ds-surface2" />
          <div className="h-3 w-24 animate-pulse rounded bg-ds-surface2" />
        </div>
      ))}
    </div>
  );
}

function deltaProps(pct: number | null, context: string) {
  return {
    value: signedPercentText(pct),
    direction: deltaDirection(pct),
    tone: deltaTone(pct),
    context,
  } as const;
}

export default function KpiRow({ filters, metrics }: KpiRowProps) {
  const { data, loading, error } = useDiagnosticsQuery<'GET /api/analytics/trend'>(
    'GET /api/analytics/trend',
    filters,
  );

  return (
    <DsCard title="Key metrics" subtitle="Current period with change against the previous equal window">
      {loading && <KpiSkeleton />}
      {!loading && error && <PanelError message={error} />}
      {!loading && !error && data && (
        <KpiContent trend={data} metrics={metrics} />
      )}
    </DsCard>
  );
}

function KpiContent({ trend, metrics }: { trend: TrendResponseDto; metrics: RevenueMetricsDto | null }) {
  const { current, delta } = trend.comparison;
  const visitorsSpark = trend.points.map((p) => p.visitors);
  const completedSpark = trend.points.map((p) => p.completed);
  const revenueSpark = trend.points.map((p) => p.revenue);

  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
      <Stat
        label="Visitors"
        value={countText(current.visitors)}
        delta={deltaProps(delta.visitorsPct, PREVIOUS_LABEL)}
        sparkline={visitorsSpark}
        sparklineColor="#2563EB"
      />
      <Stat
        label="Orders"
        value={countText(current.orders)}
        delta={deltaProps(delta.ordersPct, PREVIOUS_LABEL)}
        sparkline={completedSpark}
        sparklineColor="#16A34A"
      />
      <Stat
        label="Revenue"
        value={moneyText(current.revenue)}
        delta={deltaProps(delta.revenuePct, PREVIOUS_LABEL)}
        sparkline={revenueSpark}
        sparklineColor="#1D4ED8"
      />
      <Stat
        label="CVR"
        value={percentText(current.cvr)}
        delta={deltaProps(delta.cvrPct, PREVIOUS_LABEL)}
      />
      <Stat label="AOV" value={metrics?.aov != null ? moneyText(metrics.aov) : '—'} />
      <Stat label="RPV" value={metrics?.rpv != null ? moneyText(metrics.rpv) : '—'} />
    </div>
  );
}
