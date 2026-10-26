import * as React from 'react';
import { STATIC_CONFLICT_NOTES, type DiffResult, type DiffSeverity, type ConflictReason } from '@/lib/stats/ad-reconciliation';

// Shared by AdReconciliationTable and (per the task-11 plan) a later funnel-scoped panel, so both
// consumers render diffs and conflict explanations identically instead of growing a second copy.

const SEVERITY_CLASS: Record<DiffSeverity, string> = {
  OK: 'text-ds-muted',
  WARN: 'text-ds-warn',
  ALERT: 'text-ds-bad',
  PLATFORM_ZERO: 'text-ds-bad',
};

export function formatCount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

// Shared by any table showing platform revenue against spend, so the definition of ROAS never
// drifts between the global reconciliation table and the funnel-scoped panel.
export function formatRoas(revenueMinor: number, spendMinor: number): string {
  if (spendMinor <= 0) return '-';
  return `${(revenueMinor / spendMinor).toFixed(2)}x`;
}

// linkClicks (and any other platform-only metric that can be unreported) must render as a dash,
// never as 0 -- null means "this platform does not report this metric", not "reported as zero".
export function nullableCount(value: number | null): string {
  return value === null ? '-' : formatCount(value);
}

function diffText(diff: DiffResult, fmt: (v: number) => string): string {
  const sign = diff.diff > 0 ? '+' : '';
  const magnitude = `${sign}${fmt(diff.diff)}`;
  return diff.diffPct == null ? magnitude : `${magnitude} (${(diff.diffPct * 100).toFixed(0)}%)`;
}

export interface DiffCellProps {
  platform: number;
  onsite: number | null;
  // Null means no comparison could be made at all (e.g. REVENUE_CURRENCY_UNAVAILABLE) -- rendered
  // as an explicit "Not compared" note, never as a blank cell or a 0 diff that would read as "no
  // difference" when the truth is "we don't know".
  diff: DiffResult | null;
  currency?: string;
  unavailableNote?: string;
}

export function DiffCell({ platform, onsite, diff, currency, unavailableNote }: DiffCellProps) {
  const fmt = currency ? (v: number) => formatMoney(v, currency) : formatCount;

  if (diff === null) {
    return (
      <div className="text-right leading-tight">
        <div className="text-[13.5px] text-ds-ink font-ds-mono tabular">{fmt(platform)}</div>
        <div className="text-[11px] text-ds-muted" title={unavailableNote}>
          Not compared
        </div>
      </div>
    );
  }

  return (
    <div className="text-right leading-tight">
      <div className="text-[13.5px] text-ds-ink font-ds-mono tabular">
        {fmt(platform)} <span className="text-ds-faint">/</span> {onsite === null ? '-' : fmt(onsite)}
      </div>
      <div className={`text-[11px] font-ds-mono tabular ${SEVERITY_CLASS[diff.severity]}`}>{diffText(diff, fmt)}</div>
    </div>
  );
}

export interface ConflictTooltipProps {
  reasons: ConflictReason[];
  children: React.ReactNode;
  className?: string;
}

// Dynamic reasons (from detectConflictReasons) first, then the always-true methodology notes, so a
// reader sees what is specific to this row before the boilerplate that applies to every row.
export function ConflictTooltip({ reasons, children, className }: ConflictTooltipProps) {
  const lines = [...reasons.map((r) => r.detail), ...STATIC_CONFLICT_NOTES];
  return (
    <span className={className} title={lines.join('\n')}>
      {children}
    </span>
  );
}
