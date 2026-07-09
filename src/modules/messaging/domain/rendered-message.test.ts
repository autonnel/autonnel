import { describe, it, expect } from 'vitest';
import { RenderedMessage } from './rendered-message';

describe('RenderedMessage', () => {
  it('captures an immutable subject/html/text snapshot with headers', () => {
    const m = RenderedMessage.of({
      subject: 'Your receipt',
      html: '<p>thanks</p>',
      text: 'thanks',
      headers: { 'List-Unsubscribe': '<mailto:unsub@x.com>' },
    });
    expect(m.subject).toBe('Your receipt');
    expect(m.headers['List-Unsubscribe']).toBe('<mailto:unsub@x.com>');
    expect(Object.isFrozen(m.headers)).toBe(true);
  });

  it('requires a non-empty subject and at least one body', () => {
    expect(() => RenderedMessage.of({ subject: '', html: 'x', text: 'x', headers: {} })).toThrow(/subject/i);
    expect(() => RenderedMessage.of({ subject: 's', html: '', text: '', headers: {} })).toThrow(/body/i);
  });
});
