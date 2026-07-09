import { describe, it, expect, vi } from 'vitest';
import { ProcessDeliveryReceiptService } from './process-delivery-receipt.service';
import { Dispatch } from '../domain/dispatch';
import { Address, ChannelType, DispatchStatus, SenderIdentity, TemplateKey } from '../domain/value-objects';
import { RenderedMessage } from '../domain/rendered-message';

function sentDispatch() {
  const d = Dispatch.queue({
    tenantId: 'default', idempotencyKey: 'k', channel: ChannelType.EMAIL,
    recipient: Address.of(ChannelType.EMAIL, 'buyer@example.com'), templateKey: TemplateKey.of('order.receipt'),
    templateVersionId: 'tv', senderIdentityId: 's', correlation: { sourceContext: 'order-fulfillment' },
  });
  d.id = 'disp-1';
  d.attachRendered(RenderedMessage.of({ subject: 's', html: '<p>h</p>', text: 'h', headers: {} }), SenderIdentity.of({ fromAddress: 'a@b.com', verified: true }));
  d.markAttempt();
  d.markSent({ providerSlug: 'resend', providerMessageId: 'pm-1' });
  return d;
}

function deps() {
  const events: any[] = [];
  const upserts: any[] = [];
  return {
    events, upserts,
    dispatchRepo: { findByProviderMessageId: vi.fn(async (): Promise<Dispatch | null> => sentDispatch()), save: vi.fn(async (x: Dispatch) => x), findById: vi.fn(), findByIdempotencyKey: vi.fn(), findRetryable: vi.fn() },
    suppressionRepo: { findForAddress: vi.fn(), upsert: vi.fn(async (e: any) => { upserts.push(e); return e; }), list: vi.fn() },
    provider: { slug: 'resend', send: vi.fn(), parseWebhook: vi.fn(async (p: any) => p) },
    eventPublisher: { publish: vi.fn(async (e: any) => events.push(e)), publishMany: vi.fn() },
  };
}

describe('ProcessDeliveryReceiptService', () => {
  it('marks Delivered + emits NotificationDelivered for a delivered receipt', async () => {
    const d = deps();
    const svc = new ProcessDeliveryReceiptService(d.dispatchRepo as any, d.suppressionRepo as any, new Map([['resend', d.provider as any]]), d.eventPublisher as any);
    await svc.ingest('resend', [{ providerMessageId: 'pm-1', kind: 'DELIVERED', recipient: 'buyer@example.com', occurredAt: new Date() }]);
    expect(d.dispatchRepo.save).toHaveBeenCalled();
    const saved = (d.dispatchRepo.save as any).mock.calls[0][0] as Dispatch;
    expect(saved.status).toBe(DispatchStatus.DELIVERED);
    expect(d.events.map((e) => e.type)).toContain('messaging.NotificationDelivered');
  });

  it('hard bounce → Bounced + upserts a HardBounce suppression + emits RecipientSuppressed', async () => {
    const d = deps();
    const svc = new ProcessDeliveryReceiptService(d.dispatchRepo as any, d.suppressionRepo as any, new Map([['resend', d.provider as any]]), d.eventPublisher as any);
    await svc.ingest('resend', [{ providerMessageId: 'pm-1', kind: 'HARD_BOUNCE', recipient: 'buyer@example.com', occurredAt: new Date() }]);
    expect(d.upserts).toHaveLength(1);
    expect(d.events.map((e) => e.type)).toEqual(expect.arrayContaining(['messaging.NotificationBounced', 'messaging.RecipientSuppressed']));
  });

  it('is a no-op for an unmatched providerMessageId (orphan receipt)', async () => {
    const d = deps();
    d.dispatchRepo.findByProviderMessageId = vi.fn(async (): Promise<Dispatch | null> => null);
    const svc = new ProcessDeliveryReceiptService(d.dispatchRepo as any, d.suppressionRepo as any, new Map([['resend', d.provider as any]]), d.eventPublisher as any);
    const res = await svc.ingest('resend', [{ providerMessageId: 'unknown', kind: 'DELIVERED', recipient: 'x@y.com', occurredAt: new Date() }]);
    expect(res.processed).toBe(0);
    expect(d.dispatchRepo.save).not.toHaveBeenCalled();
  });
});
