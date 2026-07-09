import * as React from 'react';

export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
}

export interface PageHeaderProps {
  dateLabel?: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ dateLabel, title, actions, breadcrumbs, className }) => (
  <div
    className={[
      'px-8 pt-8 pb-6 flex items-end justify-between flex-wrap gap-4',
      className ?? '',
    ].filter(Boolean).join(' ')}
  >
    <div className="min-w-0">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="text-[12.5px] text-ds-muted mb-1 flex items-center gap-1.5" aria-label="Breadcrumb">
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-ds-faint">/</span>}
              {b.href ? (
                <a href={b.href} className="hover:text-ds-ink">{b.label}</a>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? 'text-ds-ink font-medium' : ''}>{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      {dateLabel !== undefined && <div className="text-[13px] text-ds-muted">{dateLabel}</div>}
      <h1 className="text-[24px] font-semibold tracking-tight text-ds-ink mt-1">{title}</h1>
    </div>
    {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
