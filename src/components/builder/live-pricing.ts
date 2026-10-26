import React from 'react';
import { usePageCurrency } from './LanguageContext';
import { injectedCheckoutCurrency } from '@/lib/storefront/checkout-currency';

// True only where the page is served to buyers (island SSR and hydration); the editor and
// draft preview keep rendering the prices stored at edit time.
const LivePricingContext = React.createContext(false);

export const LivePricingProvider = LivePricingContext.Provider;

export function useLivePricing(): boolean {
  return React.useContext(LivePricingContext);
}

export function useCheckoutCurrency(): string {
  const pageCurrency = usePageCurrency();
  return (injectedCheckoutCurrency() || pageCurrency).toUpperCase();
}
