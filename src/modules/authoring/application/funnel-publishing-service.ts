import type { PinnedPage } from '../domain/services/publication-assembler';

export interface FunnelPublicationDraft {
  funnelId: string;
  version: number;
  contentHash: string;
  entryStepSlug: string;
  pinnedPages: PinnedPage[];
}

export interface FunnelPublicationStorePort {
  latest(funnelId: string): Promise<{ version: number; contentHash: string } | null>;
  // Returns false when another writer already took this version.
  create(draft: FunnelPublicationDraft): Promise<boolean>;
  markPublished(draft: FunnelPublicationDraft): Promise<void>;
}

export interface PageSlugPort {
  slugsById(pageIds: string[]): Promise<Map<string, string>>;
}

interface PublishableFunnel {
  id: string;
  steps: readonly { stepSlug: string; pageId: string }[];
}

const MAX_ATTEMPTS = 3;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Pages are served live from `pages`, so no page_publications version is pinned (0).
export class FunnelPublishingService {
  constructor(private readonly deps: { publications: FunnelPublicationStorePort; pages: PageSlugPort }) {}

  async publish(funnel: PublishableFunnel): Promise<number | null> {
    const steps = funnel.steps.filter((s) => s.stepSlug && s.pageId);
    if (steps.length === 0) return null;
    const slugs = await this.deps.pages.slugsById(steps.map((s) => s.pageId));
    const pinnedPages: PinnedPage[] = steps.map((s) => ({
      stepSlug: s.stepSlug,
      pageId: s.pageId,
      ...(slugs.get(s.pageId) ? { pageSlug: slugs.get(s.pageId) } : {}),
      pagePublicationVersion: 0,
    }));
    const entryStepSlug = pinnedPages[0].stepSlug;
    const contentHash = await sha256Hex(JSON.stringify({ entryStepSlug, pinnedPages }));

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const latest = await this.deps.publications.latest(funnel.id);
      if (latest?.contentHash === contentHash) return latest.version;
      const draft = { funnelId: funnel.id, version: (latest?.version ?? 0) + 1, contentHash, entryStepSlug, pinnedPages };
      if (await this.deps.publications.create(draft)) {
        await this.deps.publications.markPublished(draft);
        return draft.version;
      }
    }
    throw new Error(`Could not publish funnel ${funnel.id}: version conflict`);
  }
}
