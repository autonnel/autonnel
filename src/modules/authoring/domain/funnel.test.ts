import { describe, it, expect } from 'vitest';
import { Funnel } from './funnel';

function newFunnel() {
  return Funnel.create({ id: 'f1', name: 'F' });
}

describe('Funnel', () => {
  it('rejects a duplicate stepSlug', () => {
    const funnel = newFunnel();
    funnel.addStep({ stepSlug: 'lp', pageId: 'p1' });
    expect(() => funnel.addStep({ stepSlug: 'lp', pageId: 'p2' })).toThrow(/unique|duplicate/i);
  });

  it('treats the first added step as the entry', () => {
    const funnel = newFunnel();
    funnel.addStep({ stepSlug: 'lp', pageId: 'p1' });
    expect(funnel.entryStepSlug).toBe('lp');
  });

  it('emits FunnelStructureChanged when steps change', () => {
    const funnel = newFunnel();
    const events = funnel.addStep({ stepSlug: 'lp', pageId: 'p1' });
    expect(events.map((e) => e.type)).toContain('FunnelStructureChanged');
  });

  it('removes a step by its referenced pageId and emits a structure change', () => {
    const funnel = newFunnel();
    funnel.addStep({ stepSlug: 'lp', pageId: 'p1' });
    funnel.addStep({ stepSlug: 'checkout', pageId: 'p2' });
    const events = funnel.removeStep('p1');
    expect(funnel.steps).toEqual([{ stepSlug: 'checkout', pageId: 'p2' }]);
    expect(events.map((e) => e.type)).toContain('FunnelStructureChanged');
  });

  it('removes an orphaned step whose page was deleted (pageId still pinned)', () => {
    const funnel = Funnel.rehydrate({
      id: 'f1',
      name: 'F',
      steps: [{ stepSlug: 'up', pageId: 'deleted-page' }],
      transitions: [],
      publishState: 'draft',
      publishedPinnedPages: [],
      publishedVersion: null,
    });
    funnel.removeStep('deleted-page');
    expect(funnel.steps).toEqual([]);
  });

  it('throws when removing a step that references no known page', () => {
    const funnel = newFunnel();
    funnel.addStep({ stepSlug: 'lp', pageId: 'p1' });
    expect(() => funnel.removeStep('nope')).toThrow(/No step references page: nope/);
  });

  it('preserves a remaining step’s extra fields (nextUrl) when another step is removed', () => {
    const funnel = Funnel.rehydrate({
      id: 'f1',
      name: 'F',
      steps: [
        { stepSlug: 'lp', pageId: 'p1', nextUrl: '/n/f1/checkout' } as never,
        { stepSlug: 'checkout', pageId: 'p2' },
      ],
      transitions: [],
      publishState: 'draft',
      publishedPinnedPages: [],
      publishedVersion: null,
    });
    funnel.removeStep('p2');
    expect((funnel.steps[0] as { nextUrl?: string }).nextUrl).toBe('/n/f1/checkout');
  });

  it('replaces the page a step references', () => {
    const funnel = newFunnel();
    funnel.addStep({ stepSlug: 'lp', pageId: 'p1' });
    funnel.replaceStepPage({ fromPageId: 'p1', toPageId: 'p9' });
    expect(funnel.steps).toEqual([{ stepSlug: 'lp', pageId: 'p9' }]);
  });

  it('renames a step slug, rejecting collisions', () => {
    const funnel = newFunnel();
    funnel.addStep({ stepSlug: 'lp', pageId: 'p1' });
    funnel.addStep({ stepSlug: 'checkout', pageId: 'p2' });
    funnel.setStepSlug({ pageId: 'p1', stepSlug: 'landing' });
    expect(funnel.entryStepSlug).toBe('landing');
    expect(() => funnel.setStepSlug({ pageId: 'p2', stepSlug: 'landing' })).toThrow(/unique/i);
  });
});
