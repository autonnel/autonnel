import { Money } from '@/modules/shared-kernel/money';
import type { ConversionTriggerPort } from '@/modules/acquisition-ads/application/ports/inbound';

export interface PaymentCapturedEvent {
  saleRef: string;
  sessionId: string;
  funnelId: string;
  capturedTotal: { amountMinor: number; currencyCode: string };
  capturedAtMs: number;
  contactHandle?: { emailSha256?: string; phoneSha256?: string };
  consentLevel?: 'GRANTED' | 'DENIED' | 'UNKNOWN';
}

export async function handlePaymentCaptured(
  event: PaymentCapturedEvent,
  trigger: ConversionTriggerPort,
): Promise<{ enqueuedPostbacks: number }> {
  return trigger.recordConversion({
    trigger: 'Purchase',
    sessionId: event.sessionId,
    saleId: event.saleRef,
    funnelId: event.funnelId,
    eventTimeMs: event.capturedAtMs,
    value: Money.of(event.capturedTotal.amountMinor, event.capturedTotal.currencyCode),
    consentLevel: event.consentLevel ?? 'UNKNOWN',
    contactHandle: event.contactHandle,
  });
}
