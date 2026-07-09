import React from 'react';
import { Card as DsCard, Badge } from '../primitives/ds';
import type { CheckoutMicroFunnelStageDto, PaymentsResponseDto } from '@/contracts/analytics-diagnostics';
import { useDiagnosticsQuery, type DiagnosticsFilters } from './use-diagnostics-query';
import { PanelError, PanelEmpty, PanelSkeleton } from './PanelState';
import { countText, percentText } from './format';

interface StageView {
  stage: CheckoutMicroFunnelStageDto;
  widthPct: number;
  dropPct: number | null;
}

function buildStageViews(stages: CheckoutMicroFunnelStageDto[]): StageView[] {
  const top = stages[0]?.visitors ?? 0;
  return stages.map((stage, i) => {
    const prev = stages[i - 1]?.visitors;
    const dropPct =
      prev == null ? null : prev > 0 ? ((prev - stage.visitors) / prev) * 100 : null;
    const widthPct = top > 0 ? (stage.visitors / top) * 100 : 0;
    return { stage, widthPct, dropPct };
  });
}

function StageBar({ view }: { view: StageView }) {
  const { stage, widthPct, dropPct } = view;
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)_84px] items-center gap-x-3">
      <div className="truncate text-right text-[12.5px] font-medium text-ds-ink">{stage.label}</div>
      <div className="relative h-7 overflow-hidden rounded-[6px] bg-ds-surface2">
        <div
          className="absolute inset-y-0 left-0 rounded-[6px] bg-ds-accent"
          style={{ width: `${Math.max(widthPct, stage.visitors > 0 ? 2 : 0)}%` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center px-2.5">
          <span className="text-[12px] font-semibold text-ds-ink font-ds-mono tabular">
            {countText(stage.visitors)}
          </span>
        </div>
      </div>
      <div className="text-right">
        {dropPct == null ? (
          <span className="text-[11.5px] uppercase tracking-wide text-ds-muted">Start</span>
        ) : (
          <span className="text-[12px] text-ds-bad font-ds-mono tabular">↓ {percentText(dropPct)}</span>
        )}
      </div>
    </div>
  );
}

export default function CheckoutFunnelPanel({ filters }: { filters: DiagnosticsFilters }) {
  const { data, loading, error } = useDiagnosticsQuery<'GET /api/analytics/payments'>(
    'GET /api/analytics/payments',
    filters,
  );

  const paymentErrors = data?.paymentErrors ?? 0;

  return (
    <DsCard
      title="Checkout micro-funnel"
      subtitle="Where buyers drop off between checkout view and a completed payment"
      actions={
        !loading && !error && data ? (
          <Badge tone={paymentErrors > 0 ? 'bad' : 'muted'}>
            {countText(paymentErrors)} payment {paymentErrors === 1 ? 'error' : 'errors'}
          </Badge>
        ) : undefined
      }
    >
      {loading && <PanelSkeleton rows={4} />}
      {!loading && error && <PanelError message={error} />}
      {!loading && !error && data && <CheckoutContent data={data} />}
    </DsCard>
  );
}

function CheckoutContent({ data }: { data: PaymentsResponseDto }) {
  if (data.microFunnel.length === 0) {
    return <PanelEmpty message="No checkout activity for this range" />;
  }
  const views = buildStageViews(data.microFunnel);
  return (
    <div className="flex flex-col gap-2.5">
      {views.map((view) => (
        <StageBar key={view.stage.key} view={view} />
      ))}
    </div>
  );
}
