import * as React from 'react';

export interface StatusDotProps {
  status: 'ok' | 'warn' | 'bad' | 'idle';
  blink?: boolean;
  className?: string;
  label?: string;
  'aria-label'?: string;
}

const COLOR: Record<StatusDotProps['status'], { bg: string; ring: string }> = {
  ok:   { bg: '#16A34A', ring: 'rgba(22,163,74,0.12)' },
  warn: { bg: '#D97706', ring: 'rgba(217,119,6,0.12)' },
  bad:  { bg: '#DC2626', ring: 'rgba(220,38,38,0.12)' },
  idle: { bg: '#9CA3AF', ring: 'rgba(156,163,175,0.12)' },
};

const DEFAULT_LABEL: Record<StatusDotProps['status'], string> = {
  ok: 'Status: healthy',
  warn: 'Status: attention',
  bad: 'Status: error',
  idle: 'Status: idle',
};

const StatusDot: React.FC<StatusDotProps> = ({ status, blink, className, label, ...rest }) => {
  const { bg, ring } = COLOR[status];
  const ariaLabel = label ?? rest['aria-label'] ?? DEFAULT_LABEL[status];
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={[
        'inline-block w-[7px] h-[7px] rounded-full shrink-0',
        blink ? 'animate-softblink' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      style={{ backgroundColor: bg, boxShadow: `0 0 0 3px ${ring}` }}
    />
  );
};

export default StatusDot;
