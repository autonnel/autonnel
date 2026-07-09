import { describe, it, expect } from 'vitest';
import { handlePaymentCaptured } from './payment-captured.subscriber';

describe('PaymentCaptured subscriber', () => {
  it('records a Purchase conversion carrying sessionId, saleId and the frozen HashedIdentity', async () => {
    let recorded: any;
    await handlePaymentCaptured(
      {
        saleRef: 'sale1',
        sessionId: 's1',
        funnelId: 'f1',
        capturedTotal: { amountMinor: 2999, currencyCode: 'USD' },
        capturedAtMs: 1700,
        contactHandle: { emailSha256: 'a'.repeat(64) },
        consentLevel: 'GRANTED',
      },
      { recordConversion: async (i: any) => { recorded = i; return { enqueuedPostbacks: 2 }; } } as any,
    );
    expect(recorded.trigger).toBe('Purchase');
    expect(recorded.saleId).toBe('sale1');
    expect(recorded.sessionId).toBe('s1');
    expect(recorded.value.amountMinor).toBe(2999);
    expect(recorded.contactHandle.emailSha256).toBe('a'.repeat(64));
  });

  it('defaults consent to UNKNOWN when the event omits it', async () => {
    let recorded: any;
    await handlePaymentCaptured(
      { saleRef: 'sale1', sessionId: 's1', funnelId: 'f1', capturedTotal: { amountMinor: 1, currencyCode: 'USD' }, capturedAtMs: 1 },
      { recordConversion: async (i: any) => { recorded = i; return { enqueuedPostbacks: 0 }; } } as any,
    );
    expect(recorded.consentLevel).toBe('UNKNOWN');
  });
});
