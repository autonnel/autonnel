import { describe, it, expect } from 'vitest';
import { Postback } from './postback';
import { ConversionEvent } from '../value-objects/conversion-event';
import { RetryPolicy } from '../value-objects/retry-policy';
import { PostbackTransitionError } from '../errors';

const evt = ConversionEvent.create({ eventName: 'Purchase', eventId: 'e1', eventTimeMs: 1 });

function pending() {
  return Postback.create({ id: 'p1', destinationId: 'd1', event: evt, retryPolicy: RetryPolicy.default() });
}

describe('Postback', () => {
  it('starts PENDING and transitions PENDING -> DISPATCHING -> ACKNOWLEDGED', () => {
    const p = pending();
    expect(p.status).toBe('PENDING');
    p.beginDispatch();
    expect(p.status).toBe('DISPATCHING');
    p.acknowledge('fbtrace_1');
    expect(p.status).toBe('ACKNOWLEDGED');
    expect(p.isTerminal()).toBe(true);
  });

  it('FAILED returns to PENDING while attempts remain, then DEAD when exhausted', () => {
    const p = pending();
    for (let i = 0; i < 6; i++) {
      p.beginDispatch();
      p.fail('429 throttled', true);
    }
    expect(p.status).toBe('DEAD');
    expect(p.attemptCount).toBe(6);
  });

  it('suppresses on denied consent and refuses dispatch afterward', () => {
    const p = pending();
    p.suppress('consent_denied');
    expect(p.status).toBe('SUPPRESSED');
    expect(() => p.beginDispatch()).toThrow(PostbackTransitionError);
  });

  it('keeps the ConversionEvent snapshot byte-stable across retries', () => {
    const p = pending();
    const before = JSON.stringify(p.event);
    p.beginDispatch();
    p.fail('err', true);
    expect(JSON.stringify(p.event)).toBe(before);
  });
});
