import * as React from 'react';

export interface ConsoleTokenProps {
  tone?: 'ok' | 'bad' | 'muted' | 'highlight';
  className?: string;
  children?: React.ReactNode;
}

const TONE: Record<NonNullable<ConsoleTokenProps['tone']>, string> = {
  ok:        'text-[#A7F3D0]',
  bad:       'text-[#FCA5A5]',
  muted:     'text-[#9CA3AF]',
  highlight: 'text-[#E5E7EB] font-medium',
};

const ConsoleToken: React.FC<ConsoleTokenProps> = ({ tone = 'highlight', className, children }) => (
  <span className={[TONE[tone], className ?? ''].filter(Boolean).join(' ')}>{children}</span>
);

export default ConsoleToken;
