import React from 'react';
import { Card as DsCard, Badge, SparkLine } from '../primitives/ds';
import type { TrendPointDto, TrendResponseDto } from '@/contracts/analytics-diagnostics';
import { useDiagnosticsQuery, type DiagnosticsFilters } from './use-diagnostics-query';
import { PanelError, PanelEmpty, PanelSkeleton } from './PanelState';
import { countText, moneyText } from './format';

interface SeriesDef {
  key: 'visitors' | 'completed' | 'revenue';
  label: string;
  color: string;
  money?: boolean;
}

const SERIES: SeriesDef[] = [
  { key: 'visitors', label: 'Visitors', color: '#2563EB' },
  { key: 'completed', label: 'Completed', color: '#16A34A' },
  { key: 'revenue', label: 'Revenue', color: '#1D4ED8', money: true },
];

function total(points: TrendPointDto[], key: SeriesDef['key']): number {
  return points.reduce((acc, p) => acc + p[key], 0);
}

function SmallMultiple({ series, points }: { series: SeriesDef; points: TrendPointDto[] }) {
  const values = points.map((p) => p[series.key]);
  const sum = total(points, series.key);
  return (
    <div className="rounded-[8px] border border-ds-line bg-ds-surface2 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-ds-muted">{series.label}</span>
        <span className="text-[13px] font-semibold text-ds-ink font-ds-mono tabular">
          {series.money ? moneyText(sum) : countText(sum)}
        </span>
      </div>
      <div className="mt-2.5">
        <SparkLine points={values} color={series.color} width={320} height={44} className="w-full" />
      </div>
    </div>
  );
}

export default function TrendPanel({ filters }: { filters: DiagnosticsFilters }) {
  const { data, loading, error } = useDiagnosticsQuery<'GET /api/analytics/trend'>(
    'GET /api/analytics/trend',
    filters,
  );

  const granularityLabel =
    data?.granularity === 'hour' ? 'Hourly' : data?.granularity === 'day' ? 'Daily' : null;

  return (
    <DsCard
      title="Trend"
      subtitle="Visitors, completed orders, and revenue over the selected range"
      actions={granularityLabel ? <Badge tone="muted">{granularityLabel}</Badge> : undefined}
    >
      {loading && <PanelSkeleton rows={3} />}
      {!loading && error && <PanelError message={error} />}
      {!loading && !error && data && <TrendContent data={data} />}
    </DsCard>
  );
}

function TrendContent({ data }: { data: TrendResponseDto }) {
  if (data.points.length === 0) {
    return <PanelEmpty message="No trend data for this range" />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SERIES.map((series) => (
        <SmallMultiple key={series.key} series={series} points={data.points} />
      ))}
    </div>
  );
}
