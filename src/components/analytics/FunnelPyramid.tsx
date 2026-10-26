import React, { useMemo } from 'react';
import { Card as DsCard } from '../primitives/ds';
import { buildFunnel, type FunnelStage, type FunnelUpsell } from '@/lib/stats/funnel-aggregate';
import type { FunnelStatsBag, FunnelAdTotalsDto } from '@/contracts/stats';
import { timezoneDisplay, timezoneOffsetMinutes } from '@/lib/constants/timezone';

const ROW_HEIGHT = 76;
const MIN_WIDTH = 0.08;
// Ad-side stages are deliberately a different hue from the onsite stages: they are measured by the
// platform, not by this installation, and the colour break is where that hand-off happens.
const AD_STAGE_KEYS = new Set(['adImpressions', 'adLinkClicks']);
const AD_STAGE_COLORS = ['#94A3B8', '#64748B'];
const STAGE_COLORS = ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A', '#16A34A'];

function stageColor(key: string, onsiteIndex: number): string {
  if (key === 'adImpressions') return AD_STAGE_COLORS[0];
  if (key === 'adLinkClicks') return AD_STAGE_COLORS[1];
  return STAGE_COLORS[onsiteIndex % STAGE_COLORS.length];
}

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
      <div className="flex flex-col items-end justify-center pr-3 text-right">
        <span className="text-[12.5px] font-medium leading-tight text-ds-ink">{stage.label}</span>
        {AD_STAGE_KEYS.has(stage.key) && (
          <span className="text-[10.5px] uppercase tracking-wide text-ds-faint">Platform</span>
        )}
        {stage.platformValue != null && (
          <span className="text-[11px] text-ds-muted font-ds-mono tabular" title="Reported by the ad platform for this step. Shown alongside our own count, never merged with it.">
            platform {countText(stage.platformValue)}
          </span>
        )}
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

export default function FunnelPyramid({
  stats,
  ad,
  onsiteTimezone,
}: {
  stats: FunnelStatsBag;
  ad?: FunnelAdTotalsDto | null;
  onsiteTimezone?: string;
}) {
  const funnel = useMemo(() => buildFunnel(stats, ad), [stats, ad]);
  const { stages } = funnel;
  const subtitle = ad
    ? 'Ad impression through to order, platform-reported steps first'
    : 'Visitor journey and drop-off across the funnel';
  // The platform steps are cut on the ad account's calendar and, unlike the reconciliation table
  // below, the onsite steps here come from pre-aggregated rollups that cannot be re-bucketed. Say
  // so rather than let the single funnel imply the two halves cover the same hours -- but only when
  // the calendars really differ. Zones are compared by UTC OFFSET, not by id: an operator on UTC-8
  // and an account on America/Los_Angeles are on the same clock for half the year, and the Etc/GMT
  // ids invert their own sign (Etc/GMT+8 is UTC-8), so an id comparison is wrong in both directions.
  const misalignedZones = useMemo(() => {
    if (!onsiteTimezone || !ad) return [];
    const now = new Date();
    const onsiteOffset = timezoneOffsetMinutes(onsiteTimezone, now);
    return ad.platformTimezones.filter((tz) => timezoneOffsetMinutes(tz, now) !== onsiteOffset);
  }, [ad, onsiteTimezone]);

  return (
    <DsCard title="Conversion Funnel" subtitle={subtitle}>
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
            const onsiteIndex = index - stages.filter((s, i) => i < index && AD_STAGE_KEYS.has(s.key)).length;
            return (
              <FunnelRow
                key={stage.key}
                stage={stage}
                color={stageColor(stage.key, onsiteIndex)}
                topWidth={topWidth}
                bottomWidth={bottomWidth}
              />
            );
          })}
        </div>
      </div>

      {misalignedZones.length > 0 && (
        <div className="mx-auto mt-4 max-w-3xl text-[11.5px] leading-relaxed text-ds-muted">
          Platform steps are cut on {misalignedZones.map((tz) => timezoneDisplay(tz)).join(', ')}; the
          onsite steps below them on {timezoneDisplay(onsiteTimezone!)}. The day boundaries differ, so
          the click-to-landing rate is approximate. The Ad performance table further down compares
          both sides on the ad account's own calendar.
        </div>
      )}

      <UpsellSection upsells={funnel.upsells} />
    </DsCard>
  );
}
