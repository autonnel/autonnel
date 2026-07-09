import * as React from 'react';

export interface BadgeProps {
  tone?: 'ok' | 'warn' | 'bad' | 'muted' | 'default';
  className?: string;
  children?: React.ReactNode;
}

const TONE: Record<NonNullable<BadgeProps['tone']>, string> = {
  ok:      'bg-ds-okBg border-ds-okBorder text-ds-okText',
  warn:    'bg-ds-warnBg border-ds-warnBorder text-ds-warnText',
  bad:     'bg-ds-badBg border-ds-badBorder text-ds-badText',
  muted:   'bg-ds-surface2 border-ds-line text-ds-muted',
  default: 'bg-ds-card border-ds-line text-ds-ink',
};

const Badge: React.FC<BadgeProps> = ({ tone = 'default', className, children }) => (
  <span
    className={[
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-none',
      TONE[tone],
      className ?? '',
    ].filter(Boolean).join(' ')}
  >
    {children}
  </span>
);

export default Badge;
