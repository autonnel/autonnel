import { describe, it, expect } from 'vitest';
import { InvalidActivityEventError, normalizeActivityEvent } from './activity-event';

const base = { visitorId: 'v1', occurredAt: '2026-09-02T00:00:00.000Z' };

describe('normalizeActivityEvent custom kinds', () => {
  it('keeps a well-formed custom kind untouched', () => {
    const event = normalizeActivityEvent({ ...base, kind: 'custom:buy_now' });
    expect(event.kind).toBe('custom:buy_now');
  });

  it('rejects a custom kind whose name breaks the name rule', () => {
    expect(() => normalizeActivityEvent({ ...base, kind: 'custom:1st click' }))
      .toThrow(InvalidActivityEventError);
  });

  it('rejects a double-prefixed custom kind', () => {
    expect(() => normalizeActivityEvent({ ...base, kind: 'custom:custom:x' }))
      .toThrow(InvalidActivityEventError);
  });

  it('rejects a bare prefix with no name', () => {
    expect(() => normalizeActivityEvent({ ...base, kind: 'custom:' }))
      .toThrow(InvalidActivityEventError);
  });

  it('leaves built-in kinds alone, since kind stays an open set', () => {
    expect(normalizeActivityEvent({ ...base, kind: 'page_view' }).kind).toBe('page_view');
    expect(normalizeActivityEvent({ ...base, kind: 'something_new' }).kind).toBe('something_new');
  });
});
