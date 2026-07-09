import { describe, it, expect, vi } from 'vitest';
import { SendNotificationService } from './send-notification.service';
import { Dispatch } from '../domain/dispatch';
import { SuppressionEntry } from '../domain/suppression-entry';
import { Address, ChannelType, DispatchStatus, SuppressionReason } from '../domain/value-objects';

function deps(overrides: Partial<any> = {}) {
  const saved: Dispatch[] = [];
  const events: any[] = [];
  const enqueued: any[] = [];
  return {
    saved,
    events,
    enqueued,
    dispatchRepo: {
      findByIdempotencyKey: vi.fn(async () => null),
      save: vi.fn(async (d: Dispatch) => { d.id = d.id ?? 'disp-1'; saved.push(d); return d; }),
      findById: vi.fn(),
      findByProviderMessageId: vi.fn(),
      findRetryable: vi.fn(),
    },
    suppressionRepo: { findForAddress: vi.fn(async () => [] as SuppressionEntry[]), upsert: vi.fn(), list: vi.fn() },
    jobQueue: { enqueue: vi.fn(async (i: any) => { enqueued.push(i); return { jobId: 'job-1', deduped: false }; }) },
    eventPublisher: { publish: vi.fn(async (e: any) => { events.push(e); }), publishMany: vi.fn() },
    clock: { now: () => new Date('2026-06-04T00:00:00Z') },
    ...overrides,
  };
}

const command = {
  channel: ChannelType.EMAIL,
  recipient: 'buyer@example.com',
  templateKey: 'order.receipt',
  variables: { orderNumber: '1001' },
  idempotencyKey: 'order:1001:receipt',
  sourceContext: 'order-fulfillment',
  sourceEventId: 'evt-1',
};

describe('SendNotificationService', () => {
  it('creates a QUEUED dispatch, emits NotificationQueued, enqueues messaging.send', async () => {
    const d = deps();
    const svc = new SendNotificationService(d.dispatchRepo as any, d.suppressionRepo as any, d.jobQueue as any, d.eventPublisher as any, d.clock as any);
    const res = await svc.send(command as any);
    expect(res.status).toBe('QUEUED');
    expect(res.deduped).toBe(false);
    expect(d.saved[0].status).toBe(DispatchStatus.QUEUED);
    expect(d.enqueued[0]).toMatchObject({ kind: 'messaging.send', dispatch: 'INLINE_WAIT_UNTIL' });
    expect(d.events.map((e) => e.type)).toContain('messaging.NotificationQueued');
  });

  it('is idempotent: a re-send with the same key returns the existing dispatch without re-enqueue', async () => {
    const existing = Dispatch.queue({
      tenantId: 'default', idempotencyKey: command.idempotencyKey, channel: ChannelType.EMAIL,
      recipient: Address.of(ChannelType.EMAIL, command.recipient), templateKey: { value: 'order.receipt' } as any,
      templateVersionId: 'tv', senderIdentityId: 's', correlation: { sourceContext: 'x' },
    });
    existing.id = 'disp-existing';
    const d = deps({ dispatchRepo: { findByIdempotencyKey: vi.fn(async () => existing), save: vi.fn(), findById: vi.fn(), findByProviderMessageId: vi.fn(), findRetryable: vi.fn() } });
    const svc = new SendNotificationService(d.dispatchRepo as any, d.suppressionRepo as any, d.jobQueue as any, d.eventPublisher as any, d.clock as any);
    const res = await svc.send(command as any);
    expect(res.deduped).toBe(true);
    expect(res.dispatchId).toBe('disp-existing');
    expect(d.jobQueue.enqueue).not.toHaveBeenCalled();
  });

  it('short-circuits to SUPPRESSED (no enqueue) when the address is suppressed', async () => {
    const supp = SuppressionEntry.create({
      tenantId: 'default', address: Address.of(ChannelType.EMAIL, 'buyer@example.com'),
      reason: SuppressionReason.HardBounce, source: 'provider:resend',
    });
    const d = deps({ suppressionRepo: { findForAddress: vi.fn(async () => [supp]), upsert: vi.fn(), list: vi.fn() } });
    const svc = new SendNotificationService(d.dispatchRepo as any, d.suppressionRepo as any, d.jobQueue as any, d.eventPublisher as any, d.clock as any);
    const res = await svc.send(command as any);
    expect(res.status).toBe('SUPPRESSED');
    expect(d.jobQueue.enqueue).not.toHaveBeenCalled();
    expect(d.events.map((e) => e.type)).toContain('messaging.NotificationSuppressed');
  });
});
