import React, { useMemo } from 'react';
import { Card as DsCard } from '../primitives/ds';
import { buildFunnel, type FunnelStage, type FunnelUpsell } from '@/lib/stats/funnel-aggregate';
import type { FunnelStatsBag } from '@/contracts/stats';

const ROW_HEIGHT = 76;
const MIN_WIDTH = 0.08;
const STAGE_COLORS = ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A', '#16A34A'];

function countText(value: number): string {
  return value.toLocaleString();
}

function moneyText(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function percentText(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

function displayWidth(widthPct: number, value: number): number {
  if (value <= 0) return 0;
  return Math.max(widthPct, MIN_WIDTH);
}

function trapezoidClip(topWidth: number, bottomWidth: number): string {
  const tl = ((1 - topWidth) / 2) * 100;
  const tr = ((1 + topWidth) / 2) * 100;
  const bl = ((1 - bottomWidth) / 2) * 100;
  const br = ((1 + bottomWidth) / 2) * 100;
  return `polygon(${tl}% 0, ${tr}% 0, ${br}% 100%, ${bl}% 100%)`;
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-ds-line bg-ds-surface2 px-4 py-3">
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-ds-muted">{label}</div>
      <div className="mt-1 text-[18px] font-semibold text-ds-ink font-ds-mono tabular">{value}</div>
    </div>
  );
}

function FunnelRow({
  stage,
  color,
  topWidth,
  bottomWidth,
}: {
  stage: FunnelStage;
  color: string;
  topWidth: number;
  bottomWidth: number;
}) {
  const isEntry = stage.conversionPct == null;
  return (
    <>
      <div className="flex items-center justify-end pr-3 text-right">
        <span className="text-[12.5px] font-medium leading-tight text-ds-ink">{stage.label}</span>
      </div>
      <div className="relative" style={{ height: ROW_HEIGHT }}>
        <div
          className="absolute inset-0"
          style={{ clipPath: trapezoidClip(topWidth, bottomWidth), background: color }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[16px] font-semibold font-ds-mono tabular leading-tight text-white"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.28)' }}
          >
            {countText(stage.value)}
          </span>
        </div>
      </div>
      <div className="flex flex-col justify-center pl-1">
        {isEntry ? (
          <span className="text-[11.5px] font-medium uppercase tracking-wide text-ds-muted">Entry</span>
        ) : (
          <>
            <span className="text-[15px] font-semibold text-ds-ink font-ds-mono tabular">
              {percentText(stage.conversionPct)}
            </span>
            <span className="text-[11.5px] text-ds-bad font-ds-mono tabular">
              ↓ {percentText(stage.dropPct)}
            </span>
          </>
        )}
      </div>
    </>
  );
}

function UpsellSection({ upsells }: { upsells: FunnelUpsell[] }) {
  if (upsells.length === 0) return null;
  return (
    <div className="mt-6 border-t border-ds-line pt-5">
      <div className="mb-3 text-[11.5px] font-medium uppercase tracking-wide text-ds-muted">
        Post-purchase upsells
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {upsells.map((upsell) => (
          <div key={upsell.key} className="rounded-[8px] border border-ds-line bg-ds-surface2 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] font-medium text-ds-ink">{upsell.label}</span>
              <span className="text-[13px] font-semibold text-ds-ink font-ds-mono tabular">
                {countText(upsell.value)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ds-line">
              <div
                className="h-full rounded-full bg-[#16A34A]"
                style={{ width: `${Math.min(upsell.ofOrdersPct ?? 0, 100)}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11.5px] text-ds-muted font-ds-mono tabular">
              {percentText(upsell.ofOrdersPct)} of orders
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FunnelPyramid({ stats }: { stats: FunnelStatsBag }) {
  const funnel = useMemo(() => buildFunnel(stats), [stats]);
  const { stages } = funnel;

  return (
    <DsCard title="Conversion Funnel" subtitle="Visitor journey and drop-off across the funnel">
      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Visitors" value={countText(funnel.visitors)} />
        <KpiTile label="Orders" value={countText(funnel.orders)} />
        <KpiTile label="Revenue" value={moneyText(funnel.revenue)} />
        <KpiTile label="Overall CVR" value={percentText(funnel.overallCvr)} />
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="grid grid-cols-[132px_minmax(0,1fr)_96px] items-stretch gap-x-3">
          {stages.map((stage, index) => {
            const topWidth = displayWidth(stage.widthPct, stage.value);
            const next = stages[index + 1];
            const bottomWidth = next ? displayWidth(next.widthPct, next.value) : topWidth;
            return (
              <FunnelRow
                key={stage.key}
                stage={stage}
                color={STAGE_COLORS[index % STAGE_COLORS.length]}
                topWidth={topWidth}
                bottomWidth={bottomWidth}
              />
            );
          })}
        </div>
      </div>

      <UpsellSection upsells={funnel.upsells} />
    </DsCard>
  );
}
