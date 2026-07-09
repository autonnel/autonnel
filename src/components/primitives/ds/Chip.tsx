import * as React from 'react';

export interface ChipProps {
  tone?: 'default' | 'ai' | 'edge' | 'local';
  className?: string;
  children?: React.ReactNode;
}

const TONE: Record<NonNullable<ChipProps['tone']>, string> = {
  default: 'bg-ds-surface2 border-ds-line text-ds-slate',
  ai:      'bg-[#EEF2FF] border-[#C7D2FE] text-[#4338CA]',
  edge:    'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]',
  local:   'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]',
};

const Chip: React.FC<ChipProps> = ({ tone = 'default', className, children }) => (
  <span
    className={[
      'inline-flex items-center gap-1 rounded-[6px] border px-1.5 py-[1px] text-[11.5px] font-medium leading-tight',
      TONE[tone],
      className ?? '',
    ].filter(Boolean).join(' ')}
  >
    {children}
  </span>
);

export default Chip;
