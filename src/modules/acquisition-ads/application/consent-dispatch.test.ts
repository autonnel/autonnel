import { describe, it, expect } from 'vitest';
import { DispatchPostbackService } from './dispatch-postback.service';
import { Postback } from '../domain/postback/postback';
import { ConversionEvent } from '../domain/value-objects/conversion-event';
import { RetryPolicy } from '../domain/value-objects/retry-policy';
import { HashedIdentity } from '../domain/value-objects/hashed-identity';
import type { ConsentDecision } from '../domain/services/consent-gate';

// HashedIdentity validates the SHA-256 shape, so these must be real 64-char hex digests.
const EMAIL_HASH = 'a'.repeat(64);
const PHONE_HASH = 'b'.repeat(64);

function postbackWith(decision?: ConsentDecision): Postback {
  return Postback.create({
    id: 'pb1',
    destinationId: 'dest1',
    event: ConversionEvent.create({ eventName: 'Purchase', eventId: 'e1', eventTimeMs: 1 }),
    retryPolicy: RetryPolicy.default(),
    dispatchContext: {
      clickIdentifiers: [],
      hashedIdentity: HashedIdentity.fromContactHandle({ emailSha256: EMAIL_HASH, phoneSha256: PHONE_HASH }),
      ...(decision ? { consentDecision: decision } : {}),
    },
  });
}

function build(pb: Postback) {
  const sent: Record<string, unknown>[] = [];
  const service = new DispatchPostbackService({
    postbackRepo: { findById: async () => pb, save: async () => {} } as never,
    connectionRepo: {
      findById: async () => ({
        platform: 'FACEBOOK',
        accessToken: 'sealed',
        isCapiCapable: () => true,
        destinations: [{ id: 'dest1' }],
      }),
    } as never,
    destinationToConnection: async () => 'conn1',
    tokenCipher: { open: async () => 'token', seal: async () => 'sealed' } as never,
    conversionApiFor: () =>
      ({
        sendConversion: async (input: { payload: Record<string, unknown> }) => {
          sent.push(input.payload);
          return { acknowledged: true, providerRef: 'ok' };
        },
      }) as never,
    events: { publish: async () => {} },
  });
  return { service, sent };
}

describe('DispatchPostbackService honours the recorded consent decision', () => {
  it('omits hashed identity when the decision was SEND_NON_PII', async () => {
    const { service, sent } = build(postbackWith('SEND_NON_PII'));
    await service.dispatch({ postbackId: 'pb1' });
    expect(sent[0]).not.toHaveProperty('hashedEmail');
    expect(sent[0]).not.toHaveProperty('hashedPhone');
  });

  it('includes hashed identity only when the decision was SEND_FULL', async () => {
    const { service, sent } = build(postbackWith('SEND_FULL'));
    await service.dispatch({ postbackId: 'pb1' });
    expect(sent[0]).toMatchObject({ hashedEmail: EMAIL_HASH, hashedPhone: PHONE_HASH });
  });

  it('defaults to non-PII when no decision is present on the context', async () => {
    const { service, sent } = build(postbackWith());
    await service.dispatch({ postbackId: 'pb1' });
    expect(sent[0]).not.toHaveProperty('hashedEmail');
  });
});
