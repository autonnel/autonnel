import type { ReactNode } from 'react';
import PayPalLogo from './PayPalLogo';
import StripeLogo from './StripeLogo';

const LOGOS: Record<string, () => ReactNode> = {
  PAYPAL: () => <PayPalLogo />,
  STRIPE: () => <StripeLogo />,
};

export function getProviderLogo(dbProvider: string): ReactNode {
  const factory = LOGOS[dbProvider];
  if (factory) return factory();
  return (
    <span className="text-[13px] font-semibold text-ds-muted tracking-wide">
      {dbProvider}
    </span>
  );
}
