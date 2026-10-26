// Ads are attributed to a funnel by the PATH of their destination URL only. The host is never
// trusted: an operator may point any number of domains at the same installation.

export type MatchState = 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED';

export interface PageRef {
  id: string;
  slug: string;
}

export interface FunnelRef {
  id: string;
  steps: unknown;
}

export interface PageIndex {
  pageIdByPath: Map<string, string>;
  funnelIdsByPageId: Map<string, string[]>;
}

export interface UrlMatch {
  normalizedPath: string | null;
  pageId: string | null;
  funnelId: string | null;
  candidateFunnelIds: string[];
  state: MatchState;
}

export function normalizePath(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Shape check: input must be a URL (with scheme) or a path (starting with /). new URL does not
  // throw on junk like 'not a url', it percent-encodes it into a path, so this is the only guard.
  if (!/^([a-z][a-z0-9+.-]*:|\/)/i.test(trimmed)) return null;

  let pathname: string;
  try {
    // A relative base lets a bare path parse with the same rules as an absolute URL.
    pathname = new URL(trimmed, 'https://placeholder.invalid').pathname;
  } catch {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }

  const lowered = decoded.toLowerCase();
  if (lowered === '/') return '/';
  const withoutTrailing = lowered.replace(/\/+$/, '');
  return withoutTrailing === '' ? '/' : withoutTrailing;
}

function pathForSlug(slug: string): string {
  const normalized = normalizePath(slug.startsWith('/') ? slug : `/${slug}`);
  return normalized ?? '/';
}

export function buildPageIndex(pages: PageRef[], funnels: FunnelRef[]): PageIndex {
  const pageIdByPath = new Map<string, string>();
  for (const page of pages) {
    if (!page.slug) continue;
    pageIdByPath.set(pathForSlug(page.slug), page.id);
  }

  const funnelIdsByPageId = new Map<string, string[]>();
  for (const funnel of funnels) {
    const steps = Array.isArray(funnel.steps) ? (funnel.steps as Array<{ pageId?: string }>) : [];
    const seen = new Set<string>();
    for (const step of steps) {
      const pageId = step?.pageId;
      if (!pageId || seen.has(pageId)) continue;
      seen.add(pageId);
      const list = funnelIdsByPageId.get(pageId) ?? [];
      list.push(funnel.id);
      funnelIdsByPageId.set(pageId, list);
    }
  }

  return { pageIdByPath, funnelIdsByPageId };
}

export function matchPath(rawUrl: string | null | undefined, index: PageIndex): UrlMatch {
  const normalizedPath = normalizePath(rawUrl);
  if (!normalizedPath) {
    return { normalizedPath: null, pageId: null, funnelId: null, candidateFunnelIds: [], state: 'UNMATCHED' };
  }

  const pageId = index.pageIdByPath.get(normalizedPath) ?? null;
  if (!pageId) {
    return { normalizedPath, pageId: null, funnelId: null, candidateFunnelIds: [], state: 'UNMATCHED' };
  }

  const candidateFunnelIds = index.funnelIdsByPageId.get(pageId) ?? [];
  if (candidateFunnelIds.length === 1) {
    return { normalizedPath, pageId, funnelId: candidateFunnelIds[0], candidateFunnelIds, state: 'MATCHED' };
  }
  if (candidateFunnelIds.length > 1) {
    return { normalizedPath, pageId, funnelId: null, candidateFunnelIds, state: 'AMBIGUOUS' };
  }
  return { normalizedPath, pageId, funnelId: null, candidateFunnelIds: [], state: 'UNMATCHED' };
}
