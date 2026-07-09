import * as React from 'react';

export interface ConsoleLineProps {
  ts: string;
  className?: string;
  children?: React.ReactNode;
}

const ConsoleLine: React.FC<ConsoleLineProps> = ({ ts, className, children }) => (
  <div className={['flex gap-3 items-baseline', className ?? ''].filter(Boolean).join(' ')}>
    <span className="text-[#9CA3AF] tabular shrink-0">{ts}</span>
    <span className="min-w-0 break-words">{children}</span>
  </div>
);

export default ConsoleLine;
