import { describe, it, expect } from 'vitest';
import { FunnelPublishingService, type FunnelPublicationDraft } from './funnel-publishing-service';

function memoryStore(opts: { conflictsBeforeSuccess?: number } = {}) {
  const rows: FunnelPublicationDraft[] = [];
  const published: FunnelPublicationDraft[] = [];
  let conflicts = opts.conflictsBeforeSuccess ?? 0;
  return {
    rows,
    published,
    async latest(funnelId: string) {
      const mine = rows.filter((r) => r.funnelId === funnelId).sort((a, b) => b.version - a.version);
      return mine[0] ? { version: mine[0].version, contentHash: mine[0].contentHash } : null;
    },
    async create(draft: FunnelPublicationDraft) {
      if (conflicts > 0) {
        conflicts--;
        rows.push({ ...draft, contentHash: 'other-writer' });
        return false;
      }
      rows.push(draft);
      return true;
    },
    async markPublished(draft: FunnelPublicationDraft) {
      published.push(draft);
    },
  };
}

const pages = { async slugsById(ids: string[]) { return new Map(ids.map((id) => [id, `${id}-slug`])); } };
const funnel = { id: 'f1', steps: [{ stepSlug: 'lp', pageId: 'p1' }, { stepSlug: 'checkout', pageId: 'p2' }] };

describe('FunnelPublishingService', () => {
  it('writes version 1 with the entry step, page slugs and no pinned page publication', async () => {
    const store = memoryStore();
    const version = await new FunnelPublishingService({ publications: store, pages }).publish(funnel);
    expect(version).toBe(1);
    expect(store.rows[0]).toMatchObject({
      funnelId: 'f1',
      entryStepSlug: 'lp',
      pinnedPages: [
        { stepSlug: 'lp', pageId: 'p1', pageSlug: 'p1-slug', pagePublicationVersion: 0 },
        { stepSlug: 'checkout', pageId: 'p2', pageSlug: 'p2-slug', pagePublicationVersion: 0 },
      ],
    });
    expect(store.rows[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.published.map((d) => d.version)).toEqual([1]);
  });

  it('does not bump the version when nothing changed, and bumps it when steps change', async () => {
    const store = memoryStore();
    const sut = new FunnelPublishingService({ publications: store, pages });
    await sut.publish(funnel);
    expect(await sut.publish(funnel)).toBe(1);
    expect(store.rows).toHaveLength(1);
    expect(await sut.publish({ id: 'f1', steps: [funnel.steps[1]] })).toBe(2);
    expect(store.rows[1].entryStepSlug).toBe('checkout');
  });

  it('skips funnels without steps', async () => {
    const store = memoryStore();
    expect(await new FunnelPublishingService({ publications: store, pages }).publish({ id: 'f1', steps: [] })).toBeNull();
    expect(store.rows).toEqual([]);
  });

  it('retries on a version conflict and takes the next version', async () => {
    const store = memoryStore({ conflictsBeforeSuccess: 1 });
    expect(await new FunnelPublishingService({ publications: store, pages }).publish(funnel)).toBe(2);
  });

  it('gives up after repeated conflicts', async () => {
    const store = memoryStore({ conflictsBeforeSuccess: 5 });
    await expect(new FunnelPublishingService({ publications: store, pages }).publish(funnel)).rejects.toThrow(/version conflict/);
  });
});
