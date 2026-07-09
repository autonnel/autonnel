import { describe, it, expect } from 'vitest';
import { Dispatch } from './dispatch';
import {
  Address,
  ChannelType,
  DispatchStatus,
  SenderIdentity,
  TemplateKey,
} from './value-objects';
import { RenderedMessage } from './rendered-message';

const recipient = Address.of(ChannelType.EMAIL, 'buyer@example.com');
const sender = SenderIdentity.of({ fromAddress: 'shop@store.com', verified: true });
const rendered = RenderedMessage.of({ subject: 's', html: '<p>h</p>', text: 'h', headers: {} });

function queued() {
  return Dispatch.queue({
    tenantId: 'default',
    idempotencyKey: 'idem-1',
    channel: ChannelType.EMAIL,
    recipient,
    templateKey: TemplateKey.of('order.receipt'),
    templateVersionId: 'tv-1',
    senderIdentityId: 'sender-1',
    correlation: { sourceContext: 'order-fulfillment', sourceEventId: 'evt-1' },
  });
}

describe('Dispatch.queue', () => {
  it('creates a QUEUED dispatch with attemptCount 0 and no providerMessageId', () => {
    const d = queued();
    expect(d.status).toBe(DispatchStatus.QUEUED);
    expect(d.attemptCount).toBe(0);
    expect(d.providerMessageId).toBeUndefined();
    expect(d.idempotencyKey).toBe('idem-1');
  });
});

describe('Dispatch render/send lifecycle', () => {
  it('attaches the RenderedMessage snapshot on render() → RENDERED', () => {
    const d = queued();
    d.attachRendered(rendered, sender);
    expect(d.status).toBe(DispatchStatus.RENDERED);
    expect(d.rendered).toBe(rendered);
  });

  it('cannot reach SENT without a rendered snapshot', () => {
    const d = queued();
    expect(() => d.markSent({ providerSlug: 'resend', providerMessageId: 'pm-1' })).toThrow(/rendered/i);
  });

  it('markAttempt increments attemptCount; markSent sets providerMessageId once', () => {
    const d = queued();
    d.attachRendered(rendered, sender);
    d.markAttempt();
    expect(d.attemptCount).toBe(1);
    d.markSent({ providerSlug: 'resend', providerMessageId: 'pm-1' });
    expect(d.status).toBe(DispatchStatus.SENT);
    expect(d.providerMessageId).toBe('pm-1');
    expect(() => d.markSent({ providerSlug: 'resend', providerMessageId: 'pm-2' })).toThrow(/once|already/i);
  });
});

describe('Dispatch terminal transitions', () => {
  function sent() {
    const d = queued();
    d.attachRendered(rendered, sender);
    d.markAttempt();
    d.markSent({ providerSlug: 'resend', providerMessageId: 'pm-1' });
    return d;
  }

  it('SENT → DELIVERED is allowed and terminal', () => {
    const d = sent();
    d.markDelivered();
    expect(d.status).toBe(DispatchStatus.DELIVERED);
    expect(() => d.markBounced()).toThrow(/terminal|immutable/i);
  });

  it('SENT → BOUNCED and SENT → COMPLAINED are allowed', () => {
    const a = sent(); a.markBounced(); expect(a.status).toBe(DispatchStatus.BOUNCED);
    const b = sent(); b.markComplained(); expect(b.status).toBe(DispatchStatus.COMPLAINED);
  });

  it('markFailed(retryable) stays non-terminal and allows re-attempt', () => {
    const d = queued();
    d.attachRendered(rendered, sender);
    d.markAttempt();
    d.markFailed('provider 503', true);
    expect(d.status).toBe(DispatchStatus.FAILED);
    expect(d.lastError).toBe('provider 503');
    d.markAttempt();
    expect(d.attemptCount).toBe(2);
  });

  it('any non-terminal can be SUPPRESSED or CANCELED', () => {
    const a = queued(); a.suppress(); expect(a.status).toBe(DispatchStatus.SUPPRESSED);
    const b = queued(); b.cancel(); expect(b.status).toBe(DispatchStatus.CANCELED);
  });

  it('cannot suppress a terminal dispatch', () => {
    const d = sent(); d.markDelivered();
    expect(() => d.suppress()).toThrow(/terminal|immutable/i);
  });
});
