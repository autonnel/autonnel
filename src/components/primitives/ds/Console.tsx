import * as React from 'react';

export interface ConsoleProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  hint?: React.ReactNode;
  live?: boolean;
  maxHeight?: number;
  className?: string;
  children?: React.ReactNode;
}

const Console: React.FC<ConsoleProps> = ({
  title,
  subtitle,
  hint,
  live,
  maxHeight = 360,
  className,
  children,
}) => {
  const hasHeader = title !== undefined || subtitle !== undefined || hint !== undefined;
  return (
    <div
      className={[
        'rounded-[10px] border border-[#111827] bg-[#1F2937] text-[#D1D5DB] overflow-hidden',
        className ?? '',
      ].filter(Boolean).join(' ')}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#374151]">
          <div className="min-w-0">
            {title !== undefined && (
              <div className="text-[13px] font-semibold text-[#E5E7EB] flex items-center gap-2">
                {live && <span className="inline-block w-[7px] h-[7px] rounded-full bg-[#22C55E] animate-softblink" />}
                {title}
              </div>
            )}
            {subtitle !== undefined && (
              <div className="text-[11.5px] text-[#9CA3AF] mt-0.5">{subtitle}</div>
            )}
          </div>
          {hint !== undefined && (
            <div className="text-[11px] font-ds-mono tabular text-[#9CA3AF] shrink-0">{hint}</div>
          )}
        </div>
      )}
      <div
        className="overflow-auto px-4 py-3 font-ds-mono text-[12px] leading-relaxed"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {children}
        {live && (
          <span
            className="inline-block w-[7px] h-[12px] bg-[#9CA3AF] align-middle ml-1 animate-softblink"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
};

export default Console;
