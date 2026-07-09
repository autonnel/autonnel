import * as React from 'react';

export interface NavLinkProps {
  href: string;
  icon?: React.ReactNode;
  count?: number;
  chip?: React.ReactNode;
  active?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ href, icon, count, chip, active, className, children }) => {
  const base = 'flex items-center gap-2 text-[13.5px] rounded-md px-2.5 py-[7px] transition-colors';
  const state = active
    ? 'bg-ds-card border border-ds-line shadow-[0_1px_2px_rgba(17,24,39,.04)] text-ds-ink'
    : 'border border-transparent text-[#374151] hover:bg-[#F3F4F6] hover:text-ds-ink';
  return (
    <a href={href} className={[base, state, className ?? ''].filter(Boolean).join(' ')}>
      {icon && <span className="shrink-0 text-ds-muted [&_svg]:w-4 [&_svg]:h-4">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {chip !== undefined && <span className="shrink-0">{chip}</span>}
      {count !== undefined && (
        <span className="shrink-0 text-[11px] text-ds-muted font-ds-mono tabular">{count}</span>
      )}
    </a>
  );
};

export default NavLink;
