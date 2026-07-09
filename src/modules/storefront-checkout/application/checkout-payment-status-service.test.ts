import { describe, it, expect, vi } from 'vitest';
import { CheckoutPaymentStatusService } from './checkout-payment-status-service';
import type { CapturedPaymentView } from './ports/outbound';

function readerOf(view: CapturedPaymentView | null) {
  return { loadBySaleRef: vi.fn(async () => view) };
}

describe('CheckoutPaymentStatusService', () => {
  it('returns true when the PaymentIntent is CAPTURED (H3)', async () => {
    const svc = new CheckoutPaymentStatusService(readerOf({ status: 'CAPTURED', capturedAmountMinor: 2000, currencyCode: 'USD', checkoutSnapshot: null }) as any);
    expect(await svc.isPaid('sale_1')).toBe(true);
  });

  it('returns false for an un-captured PaymentIntent', async () => {
    const svc = new CheckoutPaymentStatusService(readerOf({ status: 'PROCESSING', capturedAmountMinor: null, currencyCode: 'USD', checkoutSnapshot: null }) as any);
    expect(await svc.isPaid('sale_1')).toBe(false);
  });

  it('returns false for an unknown SaleRef', async () => {
    const svc = new CheckoutPaymentStatusService(readerOf(null) as any);
    expect(await svc.isPaid('missing')).toBe(false);
  });
});
