import * as React from 'react';

type Align = 'left' | 'right' | 'center';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {}
export interface TheadProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export interface TbodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {}
export interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}
export interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  mono?: boolean;
}

const ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };

export const Table: React.FC<TableProps> = ({ className, ...rest }) => (
  <table className={['w-full border-collapse', className ?? ''].filter(Boolean).join(' ')} {...rest} />
);

export const Thead: React.FC<TheadProps> = ({ className, ...rest }) => (
  <thead className={['bg-ds-surface2 border-b border-ds-line', className ?? ''].filter(Boolean).join(' ')} {...rest} />
);

export const Tbody: React.FC<TbodyProps> = ({ className, ...rest }) => (
  <tbody className={className} {...rest} />
);

export const Tr: React.FC<TrProps> = ({ className, ...rest }) => (
  <tr className={['hover:bg-ds-surface2 transition-colors', className ?? ''].filter(Boolean).join(' ')} {...rest} />
);

export const Th: React.FC<ThProps> = ({ align = 'left', className, scope = 'col', ...rest }) => (
  <th
    scope={scope}
    className={[
      'px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted',
      ALIGN[align],
      className ?? '',
    ].filter(Boolean).join(' ')}
    {...rest}
  />
);

export const Td: React.FC<TdProps> = ({ align = 'left', mono, className, ...rest }) => (
  <td
    className={[
      'px-4 py-3 text-[13.5px] text-ds-ink border-b border-[#F3F4F6]',
      ALIGN[align],
      mono ? 'font-ds-mono tabular' : '',
      className ?? '',
    ].filter(Boolean).join(' ')}
    {...rest}
  />
);

export default Table;
