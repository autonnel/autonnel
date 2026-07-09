import { describe, it, expect } from 'vitest';
import { AttributionResolver } from './attribution-resolver';
import { EventNormalizationService } from './event-normalization';
import { PayloadAssembler } from './payload-assembler';
import { AttributionTouch } from '../value-objects/attribution-touch';
import { ClickIdentifier } from '../value-objects/click-identifier';
import { EventMappingProfile } from '../mapping/event-mapping-profile';
import { HashedIdentity } from '../value-objects/hashed-identity';
import { Money } from '../../../shared-kernel/money';

const touch = AttributionTouch.create({
  clickIdentifiers: ClickIdentifier.fromQuery({ fbclid: 'x', gclid: 'g' }, { landingUrlTimestampMs: 1 }),
  landingUrl: 'https://shop.test/n/a?fbclid=x',
});

describe('AttributionResolver', () => {
  it('selects platform-specific identifiers for the destination platform', () => {
    const r = new AttributionResolver();
    expect(r.identifiersFor(touch, 'META')).toHaveLength(1);
    expect(r.identifiersFor(touch, 'GOOGLE')).toHaveLength(1);
    expect(r.identifiersFor(touch, 'TIKTOK')).toHaveLength(0);
  });
});

describe('EventNormalizationService', () => {
  it('produces one ConversionEvent per matching rule with a deterministic eventId', () => {
    const profile = EventMappingProfile.draft({
      id: 'm1',
      rules: [{ trigger: 'Purchase', platformEventName: 'Purchase', destinationId: 'd1', enabled: true }],
    }).activate();
    const svc = new EventNormalizationService();
    const events = svc.normalize({
      trigger: 'Purchase',
      profile,
      sessionId: 's1',
      saleId: 'sale1',
      eventTimeMs: 1700,
      value: Money.of(2999, 'USD'),
    });
    expect(events).toHaveLength(1);
    expect(events[0].destinationId).toBe('d1');
    expect(events[0].event.eventId).toBe('Purchase:s1:sale1');
    expect(events[0].event.value?.amountMinor).toBe(2999);
  });
});

describe('PayloadAssembler', () => {
  it('builds a platform-neutral payload, dropping PII when decision is SEND_NON_PII', () => {
    const a = new PayloadAssembler();
    const full = a.assemble({
      decision: 'SEND_FULL',
      identifiers: ClickIdentifier.fromQuery({ fbclid: 'x' }, { landingUrlTimestampMs: 1 }),
      hashedIdentity: HashedIdentity.fromContactHandle({ emailSha256: 'a'.repeat(64) }),
    });
    expect(full.hashedEmail).toBe('a'.repeat(64));
    const nonPii = a.assemble({
      decision: 'SEND_NON_PII',
      identifiers: ClickIdentifier.fromQuery({ fbclid: 'x' }, { landingUrlTimestampMs: 1 }),
      hashedIdentity: HashedIdentity.fromContactHandle({ emailSha256: 'a'.repeat(64) }),
    });
    expect(nonPii.hashedEmail).toBeUndefined();
    expect(nonPii.clickIds).toHaveLength(1);
  });
});
