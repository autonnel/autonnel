import { describe, it, expect, vi } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { PaymentCaptureClient } from './payment-capture-client';

describe('PaymentCaptureClient', () => {
  it('delegates to PaymentIntentCommandPort.create and returns the ClientHandle', async () => {
    const paymentsPort = {
      create: vi.fn(async (saleRef: string, amount: any, captureMethod: string) => ({
        clientHandle: `cs_${saleRef}_${amount.amountMinor}_${captureMethod}`,
      })),
    };
    const client = new PaymentCaptureClient(paymentsPort as any);
    const out = await client.createIntent('sale_1', Money.of(2000, 'USD'), 'automatic');
    expect(out.clientHandle).toBe('cs_sale_1_2000_automatic');
    expect(paymentsPort.create).toHaveBeenCalledOnce();
  });
});
