import { describe, it, expect, vi } from 'vitest';
import { RecordConversionService } from './record-conversion.service';
import { EventMappingProfile } from '../domain/mapping/event-mapping-profile';
import { AttributionTouch } from '../domain/value-objects/attribution-touch';
import { ClickIdentifier } from '../domain/value-objects/click-identifier';
import { Money } from '../../shared-kernel/money';

function deps(over: Record<string, unknown> = {}) {
  const saved: any[] = [];
  const enqueued: any[] = [];
  const profile = EventMappingProfile.draft({
    id: 'm1',
    rules: [{ trigger: 'Purchase', platformEventName: 'Purchase', destinationId: 'd1', enabled: true }],
  }).activate();
  return {
    saved,
    enqueued,
    svc: new RecordConversionService({
      mappingRepo: { findActive: async () => profile, save: async () => {} },
      attributionStore: {
        get: async () =>
          AttributionTouch.create({
            clickIdentifiers: ClickIdentifier.fromQuery({ fbclid: 'x' }, { landingUrlTimestampMs: 1 }),
            landingUrl: 'https://shop.test/n/a',
          }),
        put: async () => {},
      },
      postbackRepo: {
        findByDedup: async () => null,
        findById: async () => null,
        claimDuePending: async () => [],
        save: async (p: any) => { saved.push(p); },
      },
      jobQueue: { enqueue: async (j: any) => { enqueued.push(j); } },
      events: { publish: async () => {} },
      newId: () => 'pb-' + saved.length,
      ...over,
    } as any),
  };
}

describe('RecordConversionService', () => {
  it('creates one Postback per destination rule and enqueues a dispatch job', async () => {
    const { svc, saved, enqueued } = deps();
    const res = await svc.recordConversion({
      trigger: 'Purchase', sessionId: 's1', saleId: 'sale1', funnelId: 'f1',
      eventTimeMs: 1700, value: Money.of(2999, 'USD'), consentLevel: 'GRANTED',
      contactHandle: { emailSha256: 'a'.repeat(64) },
    });
    expect(res.enqueuedPostbacks).toBe(1);
    expect(saved[0].status).toBe('PENDING');
    expect(saved[0].eventId).toBe('Purchase:s1:sale1');
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].kind).toBe('ads.postback.dispatch');
    expect(enqueued[0].idempotencyKey).toBe('Purchase:s1:sale1:d1');
  });

  it('suppresses (no enqueue) when consent is DENIED', async () => {
    const { svc, saved, enqueued } = deps();
    const res = await svc.recordConversion({
      trigger: 'Purchase', sessionId: 's1', saleId: 'sale1', funnelId: 'f1',
      eventTimeMs: 1, consentLevel: 'DENIED',
    });
    expect(res.enqueuedPostbacks).toBe(0);
    expect(saved[0].status).toBe('SUPPRESSED');
    expect(enqueued).toHaveLength(0);
  });

  it('is idempotent: an existing dedup row is not re-created or re-enqueued', async () => {
    const existing = { status: 'PENDING' };
    const { svc, saved, enqueued } = deps({
      postbackRepo: {
        findByDedup: async () => existing,
        findById: async () => null,
        claimDuePending: async () => [],
        save: async (p: any) => saved.push(p),
      },
    });
    const res = await svc.recordConversion({
      trigger: 'Purchase', sessionId: 's1', saleId: 'sale1', funnelId: 'f1',
      eventTimeMs: 1, consentLevel: 'GRANTED',
    });
    expect(res.enqueuedPostbacks).toBe(0);
    expect(saved).toHaveLength(0);
    expect(enqueued).toHaveLength(0);
  });
});
