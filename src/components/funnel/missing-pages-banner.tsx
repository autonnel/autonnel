import AlertBox from '../primitives/AlertBox';

interface FunnelCheckoutBannerProps {
  hasCheckoutStep: boolean;
  className?: string;
}

export default function FunnelCheckoutBanner({
  hasCheckoutStep,
  className = '',
}: FunnelCheckoutBannerProps) {
  if (hasCheckoutStep) return null;

  return (
    <div className={className}>
      <AlertBox type="warning" title="No checkout step" className="mb-4">
        <p className="mb-3">
          This funnel has no checkout step. Add a checkout page so customers can complete a purchase.
        </p>
        <a
          href="/pages?create=CHECKOUT"
          className="inline-flex items-center gap-1 text-sm font-medium underline hover:no-underline"
        >
          Go to Pages
        </a>
      </AlertBox>
    </div>
  );
}
