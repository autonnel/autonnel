import { describe, it, expect } from 'vitest';
import { rowToDispatch, dispatchToRow } from './dispatch.mapper';
import { Dispatch } from '../../domain/dispatch';
import { Address, ChannelType, SenderIdentity, TemplateKey } from '../../domain/value-objects';
import { RenderedMessage } from '../../domain/rendered-message';

describe('dispatch mapper', () => {
  it('round-trips a SENT dispatch with rendered snapshot', () => {
    const d = Dispatch.queue({
      tenantId: 'default', idempotencyKey: 'k1', channel: ChannelType.EMAIL,
      recipient: Address.of(ChannelType.EMAIL, 'b@x.com'), templateKey: TemplateKey.of('order.receipt'),
      templateVersionId: 'tv-1', senderIdentityId: 's-1', correlation: { sourceContext: 'order-fulfillment', sourceEventId: 'e1' },
    });
    d.id = 'disp-1';
    d.attachRendered(RenderedMessage.of({ subject: 's', html: '<p>h</p>', text: 'h', headers: { 'List-Unsubscribe': '<x>' } }), SenderIdentity.of({ fromAddress: 'a@b.com', verified: true }));
    d.markAttempt();
    d.markSent({ providerSlug: 'resend', providerMessageId: 'pm-1' });

    const row = dispatchToRow(d);
    expect(row.status).toBe('SENT');
    expect(row.providerMessageId).toBe('pm-1');

    const back = rowToDispatch(row as any);
    expect(back.status).toBe(d.status);
    expect(back.providerMessageId).toBe('pm-1');
    expect(back.rendered?.subject).toBe('s');
    expect(back.recipient.normalized).toBe('b@x.com');
  });
});
