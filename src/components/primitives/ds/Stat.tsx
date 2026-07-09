import * as React from 'react';
import SparkLine from './SparkLine';

export interface StatDelta {
  value: string | number;
  direction: 'up' | 'down';
  tone?: 'ok' | 'bad' | 'muted';
  context?: string;
}

export interface StatProps {
  label: React.ReactNode;
  value: string | number;
  unit?: React.ReactNode;
  delta?: StatDelta;
  sparkline?: number[];
  sparklineColor?: string;
  className?: string;
}

const TONE: Record<NonNullable<StatDelta['tone']>, string> = {
  ok:    'text-ds-ok',
  bad:   'text-ds-bad',
  muted: 'text-ds-muted',
};

const Stat: React.FC<StatProps> = ({ label, value, unit, delta, sparkline, sparklineColor, className }) => (
  <div className={['flex flex-col gap-1', className ?? ''].filter(Boolean).join(' ')}>
    <div className="text-[12.5px] text-ds-muted">{label}</div>
    <div className="flex items-baseline gap-1.5">
      <span className="text-[26px] font-semibold tracking-tight font-ds-mono tabular text-ds-ink leading-none">
        {value}
      </span>
      {unit !== undefined && <span className="text-[13px] text-ds-muted font-normal">{unit}</span>}
    </div>
    {delta && (
      <div className={['text-[11.5px] flex items-center gap-1', TONE[delta.tone ?? 'muted']].join(' ')}>
        <span aria-hidden="true">{delta.direction === 'up' ? '↑' : '↓'}</span>
        <span className="font-ds-mono tabular">{delta.value}</span>
        {delta.context && <span className="text-ds-muted">· {delta.context}</span>}
      </div>
    )}
    {sparkline && sparkline.length > 0 && (
      <div className="mt-1">
        <SparkLine points={sparkline} color={sparklineColor} />
      </div>
    )}
  </div>
);

export default Stat;
