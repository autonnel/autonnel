import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'sm' | 'md';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]',
  primary: 'bg-ds-ink border border-ds-ink text-ds-card hover:bg-[#1F2937]',
  ghost:   'bg-transparent border border-transparent text-ds-ink hover:bg-[#F3F4F6]',
};

const SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5',
  md: 'h-8 px-3 text-[13px] gap-2',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', leftIcon, rightIcon, asChild, className, children, ...rest }, ref) => {
    const cls = [
      'inline-flex items-center justify-center font-medium rounded-[7px] transition-colors',
      'disabled:opacity-50 disabled:pointer-events-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-1',
      VARIANT[variant],
      SIZE[size],
      className ?? '',
    ].filter(Boolean).join(' ');

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
      return React.cloneElement(child, {
        className: [cls, child.props.className ?? ''].filter(Boolean).join(' '),
        children: (
          <>
            {leftIcon}
            {child.props.children}
            {rightIcon}
          </>
        ),
      });
    }

    return (
      <button ref={ref} className={cls} {...rest}>
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  },
);
Button.displayName = 'DsButton';

export default Button;
