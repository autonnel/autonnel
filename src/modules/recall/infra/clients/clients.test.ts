import { describe, it, expect, vi } from 'vitest';
import { MessagingPortClient } from './messaging.client';
import { CheckoutPaymentStatusPortClient } from './checkout-payment-status.client';
import { WorkersClockAdapter } from '../workers-clock';

describe('MessagingPortClient', () => {
  it('forwards a composed Touch to Messaging SendNotificationPort and returns the handoff ref', async () => {
    const sendNotification = { send: vi.fn().mockResolvedValue({ dispatchId: 'd1' }) };
    const client = new MessagingPortClient(sendNotification as any);
    const out = await client.sendTouch({
      channel: 'email', recipientAddress: 'a@b.co', templateKey: 'recall.abandoned_checkout',
      mergeVariables: { resumeLink: 'x' }, idempotencyKey: 'att_1::step:0',
    });
    expect(sendNotification.send).toHaveBeenCalledWith(expect.objectContaining({
      templateKey: 'recall.abandoned_checkout', idempotencyKey: 'att_1::step:0',
    }));
    expect(out.messageHandoffRef).toBe('d1');
  });
});

describe('CheckoutPaymentStatusPortClient (H3)', () => {
  it('returns authoritative paid/voided from the Storefront read port', async () => {
    const read = { readPaidStatus: vi.fn().mockResolvedValue({ paid: true, voided: false }) };
    const client = new CheckoutPaymentStatusPortClient(read as any);
    expect(await client.getStatus('sess_1')).toEqual({ paid: true, voided: false });
  });
});

describe('WorkersClockAdapter', () => {
  it('returns a Date', () => {
    expect(new WorkersClockAdapter().now()).toBeInstanceOf(Date);
  });
});
