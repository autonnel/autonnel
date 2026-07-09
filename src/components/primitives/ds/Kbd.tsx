import * as React from 'react';

export interface KbdProps {
  className?: string;
  children?: React.ReactNode;
}

const Kbd: React.FC<KbdProps> = ({ className, children }) => (
  <kbd
    className={[
      'inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-[5px]',
      'bg-ds-surface2 border border-ds-line text-ds-slate',
      'font-ds-mono text-[10.5px] leading-none',
      className ?? '',
    ].filter(Boolean).join(' ')}
  >
    {children}
  </kbd>
);

export default Kbd;
