import { describe, it, expect } from 'vitest';
import { canPublish, canTransitionTo } from './publish-state';

describe('PublishState', () => {
  it('a draft can publish', () => expect(canPublish('draft')).toBe(true));
  it('draft_ahead can publish', () => expect(canPublish('draft_ahead')).toBe(true));
  it('a published page cannot directly re-publish without diverging', () =>
    expect(canPublish('published')).toBe(false));
  it('allows published -> draft_ahead', () =>
    expect(canTransitionTo('published', 'draft_ahead')).toBe(true));
  it('forbids draft -> draft_ahead', () =>
    expect(canTransitionTo('draft', 'draft_ahead')).toBe(false));
});
