import { describe, it, expect, vi } from 'vitest';
import { FunnelComposingService } from './funnel-composing-service';
import { Funnel } from '../domain/funnel';

describe('FunnelComposingService', () => {
  it('adds a step to the funnel and publishes events', async () => {
    const funnel = Funnel.create({ id: 'f1', name: 'F' });
    const funnels = { load: vi.fn().mockResolvedValue(funnel), save: vi.fn(), lastPublishedVersion: vi.fn() };
    const pages = { exists: vi.fn().mockResolvedValue(true) };
    const events = { publish: vi.fn() };
    const sut = new FunnelComposingService({ funnels, pages, events });

    await sut.addStep({ funnelId: 'f1', stepSlug: 'lp', pageId: 'p1' });

    expect(funnels.save).toHaveBeenCalledOnce();
    expect(events.publish).toHaveBeenCalledOnce();
    expect(funnel.steps).toEqual([{ stepSlug: 'lp', pageId: 'p1' }]);
  });

  it('throws when the funnel is not found', async () => {
    const funnels = { load: vi.fn().mockResolvedValue(null), save: vi.fn(), lastPublishedVersion: vi.fn() };
    const pages = { exists: vi.fn() };
    const events = { publish: vi.fn() };
    const sut = new FunnelComposingService({ funnels, pages, events });

    await expect(sut.addStep({ funnelId: 'missing', stepSlug: 'lp', pageId: 'p1' })).rejects.toThrow(/Funnel not found: missing/);
    expect(pages.exists).not.toHaveBeenCalled();
    expect(funnels.save).not.toHaveBeenCalled();
  });

  it('throws when the referenced page is not found', async () => {
    const funnel = Funnel.create({ id: 'f1', name: 'F' });
    const funnels = { load: vi.fn().mockResolvedValue(funnel), save: vi.fn(), lastPublishedVersion: vi.fn() };
    const pages = { exists: vi.fn().mockResolvedValue(false) };
    const events = { publish: vi.fn() };
    const sut = new FunnelComposingService({ funnels, pages, events });

    await expect(sut.addStep({ funnelId: 'f1', stepSlug: 'lp', pageId: 'missing' })).rejects.toThrow(/Referenced page not found: missing/);
    expect(funnels.save).not.toHaveBeenCalled();
  });

  it('removes a step and persists, without needing the page to still exist', async () => {
    const funnel = Funnel.create({ id: 'f1', name: 'F' });
    funnel.addStep({ stepSlug: 'up', pageId: 'deleted-page' });
    const funnels = { load: vi.fn().mockResolvedValue(funnel), save: vi.fn(), lastPublishedVersion: vi.fn() };
    const pages = { exists: vi.fn() };
    const events = { publish: vi.fn() };
    const sut = new FunnelComposingService({ funnels, pages, events });

    await sut.removeStep({ funnelId: 'f1', pageId: 'deleted-page' });

    expect(pages.exists).not.toHaveBeenCalled();
    expect(funnel.steps).toEqual([]);
    expect(funnels.save).toHaveBeenCalledOnce();
    expect(events.publish).toHaveBeenCalledOnce();
  });

  it('replaces a step page, requiring the new page to exist', async () => {
    const funnel = Funnel.create({ id: 'f1', name: 'F' });
    funnel.addStep({ stepSlug: 'up', pageId: 'old' });
    const funnels = { load: vi.fn().mockResolvedValue(funnel), save: vi.fn(), lastPublishedVersion: vi.fn() };
    const pages = { exists: vi.fn().mockResolvedValue(true) };
    const events = { publish: vi.fn() };
    const sut = new FunnelComposingService({ funnels, pages, events });

    await sut.replaceStep({ funnelId: 'f1', fromPageId: 'old', toPageId: 'new' });

    expect(funnel.steps).toEqual([{ stepSlug: 'up', pageId: 'new' }]);
    expect(funnels.save).toHaveBeenCalledOnce();
  });

  it('updates a step slug', async () => {
    const funnel = Funnel.create({ id: 'f1', name: 'F' });
    funnel.addStep({ stepSlug: 'up', pageId: 'p1' });
    const funnels = { load: vi.fn().mockResolvedValue(funnel), save: vi.fn(), lastPublishedVersion: vi.fn() };
    const pages = { exists: vi.fn() };
    const events = { publish: vi.fn() };
    const sut = new FunnelComposingService({ funnels, pages, events });

    await sut.setStepSlug({ funnelId: 'f1', pageId: 'p1', stepSlug: 'upsell' });

    expect(funnel.entryStepSlug).toBe('upsell');
    expect(funnels.save).toHaveBeenCalledOnce();
  });
});
