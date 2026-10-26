import { describe, it, expect } from 'vitest';
import { FunnelSession } from '../domain/funnel-session';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { serializeSession, deserializeSession, type SerializedSession } from './session-serializer';

const fallback = { countryCode: 'US', currencyCode: 'USD' };

function session(market: { countryCode: string; currencyCode: string }) {
  return FunnelSession.start({
    sessionId: 'sess_1', tenantId: 'default', snapshotRef: FunnelSnapshotRef.of('fn_1', 1),
    stepSlugs: [StepSlug.of('checkout')], attribution: AttributionSnapshot.empty('sess_1'), entryStep: StepSlug.of('checkout'),
    market,
  });
}

describe('session serializer', () => {
  it('round-trips market', () => {
    const raw = JSON.parse(JSON.stringify(serializeSession(session({ countryCode: 'DE', currencyCode: 'EUR' })))) as SerializedSession;
    expect(raw.market).toEqual({ countryCode: 'DE', currencyCode: 'EUR' });
    expect(deserializeSession(raw, fallback).market).toEqual({ countryCode: 'DE', currencyCode: 'EUR' });
  });

  it('deserializes legacy session without market', () => {
    const { market: _drop, ...legacy } = serializeSession(session({ countryCode: 'DE', currencyCode: 'EUR' }));
    expect(deserializeSession(legacy as SerializedSession, { countryCode: 'GB', currencyCode: 'GBP' }).market).toEqual({ countryCode: 'GB', currencyCode: 'GBP' });
  });
});
