import { describe, it, expect } from 'vitest';
import { DeduplicationKeyDeriver } from './deduplication-key-deriver';
import { ConsentGate } from './consent-gate';
import { ConnectionHealthEvaluator } from './connection-health-evaluator';
import { ConsentState } from '../value-objects/consent-state';

describe('DeduplicationKeyDeriver', () => {
  it('derives a deterministic browser-compatible eventId from trigger+session+sale', () => {
    const d = new DeduplicationKeyDeriver();
    const a = d.derive({ trigger: 'Purchase', sessionId: 's1', saleId: 'sale1' });
    const b = d.derive({ trigger: 'Purchase', sessionId: 's1', saleId: 'sale1' });
    expect(a).toBe(b);
    expect(a).toBe('Purchase:s1:sale1');
    expect(d.derive({ trigger: 'PageView', sessionId: 's1' })).toBe('PageView:s1:0');
  });
});

describe('ConsentGate', () => {
  const gate = new ConsentGate();
  it('SEND_FULL when granted, SUPPRESS when denied, SEND_NON_PII when unknown', () => {
    expect(gate.decide(ConsentState.granted())).toBe('SEND_FULL');
    expect(gate.decide(ConsentState.denied())).toBe('SUPPRESS');
    expect(gate.decide(ConsentState.unknown())).toBe('SEND_NON_PII');
  });
});

describe('ConnectionHealthEvaluator', () => {
  const ev = new ConnectionHealthEvaluator();
  it('flags an access token within the refresh window as needing refresh', () => {
    const soon = new Date(Date.now() + 60_000);
    expect(ev.needsRefresh({ accessTokenExpiresAt: soon, status: 'ACTIVE' })).toBe(true);
    const later = new Date(Date.now() + 3_600_000);
    expect(ev.needsRefresh({ accessTokenExpiresAt: later, status: 'ACTIVE' })).toBe(false);
  });
  it('reports degraded when not CAPI-capable', () => {
    expect(ev.isDegraded({ status: 'REVOKED' })).toBe(true);
    expect(ev.isDegraded({ status: 'ACTIVE' })).toBe(false);
  });
});
