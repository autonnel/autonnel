import * as React from 'react';

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  padded?: boolean;
}

function classes(...c: Array<string | false | undefined>): string {
  return c.filter(Boolean).join(' ');
}

const Card: React.FC<CardProps> = ({ title, subtitle, actions, className, children, padded = true }) => {
  const hasHeader = title !== undefined || subtitle !== undefined || actions !== undefined;
  return (
    <div
      className={classes(
        'bg-ds-card border border-ds-line rounded-[10px] shadow-[0_1px_2px_rgba(17,24,39,.04)]',
        className,
      )}
    >
      {hasHeader && (
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title !== undefined && <div className="text-[14px] font-semibold text-ds-ink">{title}</div>}
            {subtitle !== undefined && <div className="text-[12.5px] text-ds-muted mt-0.5">{subtitle}</div>}
          </div>
          {actions !== undefined && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children !== undefined && (
        <div className={classes(padded && (hasHeader ? 'px-6 pb-5' : 'px-6 py-5'))}>{children}</div>
      )}
    </div>
  );
};

export default Card;
