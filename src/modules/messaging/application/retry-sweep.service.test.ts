import { describe, it, expect, vi } from 'vitest';
import { RetrySweepService } from './retry-sweep.service';
import { Dispatch } from '../domain/dispatch';
import { RetrySchedule } from '../domain/retry-schedule';
import { Address, ChannelType, DispatchStatus, TemplateKey } from '../domain/value-objects';

function failedDispatch(attempts: number) {
  const d = Dispatch.queue({
    tenantId: 'default', idempotencyKey: 'k', channel: ChannelType.EMAIL,
    recipient: Address.of(ChannelType.EMAIL, 'b@x.com'), templateKey: TemplateKey.of('order.receipt'),
    templateVersionId: 'tv', senderIdentityId: 's', correlation: { sourceContext: 'order-fulfillment' },
  });
  d.id = 'disp-1';
  for (let i = 0; i < attempts; i++) d.markAttempt();
  d.markFailed('503', true);
  return d;
}

function deps(overrides: Partial<any> = {}) {
  const enqueued: any[] = [];
  const saved: any[] = [];
  return {
    enqueued, saved,
    dispatchRepo: { findRetryable: vi.fn(async () => [failedDispatch(1)]), save: vi.fn(async (x: Dispatch) => { saved.push(x); return x; }), findById: vi.fn(), findByIdempotencyKey: vi.fn(), findByProviderMessageId: vi.fn() },
    jobQueue: { enqueue: vi.fn(async (i: any) => { enqueued.push(i); return { jobId: 'j', deduped: false }; }) },
    schedule: RetrySchedule.of({ baseDelaySeconds: 60, maxAttempts: 3 }),
    clock: { now: () => new Date('2026-06-04T00:00:00Z') },
    ...overrides,
  };
}

describe('RetrySweepService', () => {
  it('re-enqueues a messaging.send job for a due retryable dispatch', async () => {
    const d = deps();
    const svc = new RetrySweepService(d.dispatchRepo as any, d.jobQueue as any, d.schedule, d.clock as any);
    const res = await svc.sweep(50);
    expect(res.retried).toBe(1);
    expect(d.enqueued[0]).toMatchObject({ kind: 'messaging.send', dispatch: 'INLINE_WAIT_UNTIL' });
  });

  it('cancels a dispatch whose attempts are exhausted instead of re-enqueueing', async () => {
    const d = deps({ dispatchRepo: { findRetryable: vi.fn(async () => [failedDispatch(3)]), save: vi.fn(async (x: Dispatch) => x), findById: vi.fn(), findByIdempotencyKey: vi.fn(), findByProviderMessageId: vi.fn() } });
    const svc = new RetrySweepService(d.dispatchRepo as any, d.jobQueue as any, d.schedule, d.clock as any);
    const res = await svc.sweep(50);
    expect(res.canceled).toBe(1);
    expect(d.jobQueue.enqueue).not.toHaveBeenCalled();
  });
});
