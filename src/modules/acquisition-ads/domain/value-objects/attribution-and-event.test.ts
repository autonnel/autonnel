import { describe, it, expect } from 'vitest';
import { AttributionTouch } from './attribution-touch';
import { ConversionEvent } from './conversion-event';
import { isConversionScopeSatisfied } from './platform-ref';
import { ClickIdentifier } from './click-identifier';
import { Money } from '../../../shared-kernel/money';

describe('AttributionTouch', () => {
  it('keeps click ids + cookies + landing but drops transient ip/UA from serialization', () => {
    const touch = AttributionTouch.create({
      clickIdentifiers: ClickIdentifier.fromQuery({ fbclid: 'x' }, { landingUrlTimestampMs: 1 }),
      fbp: 'fb.1.1.2',
      ga: 'GA1.2.3',
      landingUrl: 'https://shop.test/n/abc?fbclid=x',
      transientIp: '1.2.3.4',
      transientUserAgent: 'UA',
    });
    expect(touch.identifiersForPlatform('META')).toHaveLength(1);
    const json = JSON.parse(JSON.stringify(touch.toPersistence()));
    expect(json.transientIp).toBeUndefined();
    expect(json.landingUrl).toContain('fbclid');
  });
});

describe('ConversionEvent', () => {
  it('is an immutable snapshot carrying a deterministic eventId and Money value', () => {
    const e = ConversionEvent.create({
      eventName: 'Purchase',
      eventId: 'evt_123',
      eventTimeMs: 1700,
      value: Money.of(2999, 'USD'),
    });
    expect(e.eventId).toBe('evt_123');
    expect(e.value?.amountMinor).toBe(2999);
    expect(Object.isFrozen(e)).toBe(true);
  });
});

describe('PlatformCapability', () => {
  it('confirms granted scopes superset the required conversion scopes', () => {
    expect(isConversionScopeSatisfied(['ads_management', 'business_management'], ['ads_management'])).toBe(true);
    expect(isConversionScopeSatisfied(['email'], ['ads_management'])).toBe(false);
  });
});
