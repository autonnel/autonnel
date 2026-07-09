import { describe, it, expect, vi } from 'vitest';
import { runRecallDueTouchSweep } from './process-due-touches.cron';
import { dispatchRecallEvent } from '../subscribers/recall-event-subscriber';

describe('runRecallDueTouchSweep', () => {
  it('drives processDueBatch with the configured batch size', async () => {
    const recall = { processDueTouch: { processDueBatch: vi.fn().mockResolvedValue({ processed: 3 }) } };
    const out = await runRecallDueTouchSweep(recall as any, 50);
    expect(recall.processDueTouch.processDueBatch).toHaveBeenCalledWith(50);
    expect(out.processed).toBe(3);
  });
});

describe('dispatchRecallEvent', () => {
  it('routes FunnelSessionAbandoned to DetectAndEnroll', async () => {
    const recall = {
      detectAndEnroll: { handle: vi.fn() },
      handleCheckoutPaid: { handle: vi.fn() },
      handleEngagementCallback: { onRecipientSuppressed: vi.fn(), onEngagement: vi.fn() },
    };
    await dispatchRecallEvent(recall as any, { type: 'FunnelSessionAbandoned', payload: { checkoutRef: 'sess_1' } });
    expect(recall.detectAndEnroll.handle).toHaveBeenCalled();
  });

  it('routes PaymentCaptured to HandleCheckoutPaid', async () => {
    const recall = {
      detectAndEnroll: { handle: vi.fn() },
      handleCheckoutPaid: { handle: vi.fn() },
      handleEngagementCallback: { onRecipientSuppressed: vi.fn(), onEngagement: vi.fn() },
    };
    await dispatchRecallEvent(recall as any, { type: 'PaymentCaptured', payload: { saleRef: 's', checkoutRef: 'sess_1', capturedAt: '2026-06-04T10:00:00Z' } });
    expect(recall.handleCheckoutPaid.handle).toHaveBeenCalled();
  });

  it('routes RecipientSuppressed to the engagement-callback handler', async () => {
    const recall = {
      detectAndEnroll: { handle: vi.fn() },
      handleCheckoutPaid: { handle: vi.fn() },
      handleEngagementCallback: { onRecipientSuppressed: vi.fn(), onEngagement: vi.fn() },
    };
    await dispatchRecallEvent(recall as any, { type: 'RecipientSuppressed', payload: { channel: 'email', normalizedAddress: 'a@b.co', hashedIdentity: 'h1', messagingReason: 'HardBounce' } });
    expect(recall.handleEngagementCallback.onRecipientSuppressed).toHaveBeenCalled();
  });

  it('ignores unrelated event types', async () => {
    const recall = { detectAndEnroll: { handle: vi.fn() }, handleCheckoutPaid: { handle: vi.fn() }, handleEngagementCallback: { onRecipientSuppressed: vi.fn(), onEngagement: vi.fn() } };
    await dispatchRecallEvent(recall as any, { type: 'SomethingElse', payload: {} });
    expect(recall.detectAndEnroll.handle).not.toHaveBeenCalled();
  });
});
