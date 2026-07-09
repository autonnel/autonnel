export interface CheckoutIslandProps {
  funnelId: string;
  step: string;
}

export default function CheckoutIsland({ funnelId, step }: CheckoutIslandProps) {
  return <div data-checkout-island data-funnel-id={funnelId} data-step={step} hidden />;
}
