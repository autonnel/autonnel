import { describe, it, expect, vi } from 'vitest';
import { HandleEngagementCallbackService } from './handle-engagement-callback.service';

const deps = () => ({
  suppressionRepo: { findActiveBySubject: vi.fn(), upsert: vi.fn(), list: vi.fn(), remove: vi.fn() },
  events: { publish: vi.fn() },
  clock: { now: () => new Date('2026-06-04T10:00:00Z') },
});

describe('HandleEngagementCallbackService', () => {
  it('maps a Messaging RecipientSuppressed (HardBounce) to a Recall contact suppression (H2)', async () => {
    const d = deps();
    const svc = new HandleEngagementCallbackService(d.suppressionRepo as any, d.events as any, d.clock);
    await svc.onRecipientSuppressed({ channel: 'email', normalizedAddress: 'a@b.co', hashedIdentity: 'h1', messagingReason: 'HardBounce' });
    const entry = d.suppressionRepo.upsert.mock.calls[0][0];
    expect(entry.scope).toBe('contact');
    expect(entry.subjectKey).toBe('h1');
    expect(entry.reason).toBe('bounce');
    expect(d.events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'ContactSuppressed' }));
  });

  it('records an unsubscribe engagement as a permanent contact suppression', async () => {
    const d = deps();
    const svc = new HandleEngagementCallbackService(d.suppressionRepo as any, d.events as any, d.clock);
    await svc.onEngagement({ messageHandoffRef: 'm1', engagement: 'unsubscribed', hashedIdentity: 'h1' } as any);
    expect(d.suppressionRepo.upsert).toHaveBeenCalled();
  });
});
