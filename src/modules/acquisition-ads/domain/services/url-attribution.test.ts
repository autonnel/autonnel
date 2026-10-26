import { describe, it, expect } from 'vitest';
import { normalizePath, buildPageIndex, matchPath } from './url-attribution';

describe('normalizePath', () => {
  it('keeps only the lowercased path and drops query and fragment', () => {
    expect(normalizePath('https://Shop.X.com/LP-Glow?utm_source=fb&fbclid=1#top')).toBe('/lp-glow');
  });

  it('strips the trailing slash but keeps the root as /', () => {
    expect(normalizePath('https://a.com/lp/')).toBe('/lp');
    expect(normalizePath('https://a.com/')).toBe('/');
  });

  it('decodes percent-encoding so the slug compares equal', () => {
    expect(normalizePath('https://a.com/lp%2Dglow')).toBe('/lp-glow');
  });

  it('accepts a bare path with no host, because the host is never trusted', () => {
    expect(normalizePath('/lp-glow?x=1')).toBe('/lp-glow');
  });

  it('returns null for unusable input', () => {
    expect(normalizePath(null)).toBeNull();
    expect(normalizePath('')).toBeNull();
    expect(normalizePath('not a url')).toBeNull();
  });

  it('keeps the path when the query string contains an unencoded space', () => {
    expect(normalizePath('https://a.com/lp-glow?utm_term=hello world')).toBe('/lp-glow');
  });

  it('keeps the path when the fragment contains an unencoded space', () => {
    expect(normalizePath('https://a.com/lp-glow#a b')).toBe('/lp-glow');
  });

  it('accepts a protocol-relative url', () => {
    expect(normalizePath('//a.com/lp-glow')).toBe('/lp-glow');
  });
});

describe('matchPath', () => {
  const index = buildPageIndex(
    [
      { id: 'page-lp', slug: 'lp-glow' },
      { id: 'page-shared', slug: 'shared-lp' },
      { id: 'page-orphan', slug: 'orphan' },
    ],
    [
      { id: 'funnel-a', steps: [{ pageId: 'page-lp' }, { pageId: 'page-shared' }] },
      { id: 'funnel-b', steps: [{ pageId: 'page-shared' }] },
    ],
  );

  it('matches a page owned by exactly one funnel', () => {
    const m = matchPath('https://any-domain.example/lp-glow?fbclid=1', index);
    expect(m).toEqual({
      normalizedPath: '/lp-glow',
      pageId: 'page-lp',
      funnelId: 'funnel-a',
      candidateFunnelIds: ['funnel-a'],
      state: 'MATCHED',
    });
  });

  it('reports AMBIGUOUS when the page is referenced by several funnels', () => {
    const m = matchPath('https://any-domain.example/shared-lp', index);
    expect(m.state).toBe('AMBIGUOUS');
    expect(m.funnelId).toBeNull();
    expect(m.candidateFunnelIds).toEqual(['funnel-a', 'funnel-b']);
  });

  it('reports UNMATCHED when the page belongs to no funnel', () => {
    expect(matchPath('https://any-domain.example/orphan', index).state).toBe('UNMATCHED');
  });

  it('reports UNMATCHED when no page has that slug', () => {
    const m = matchPath('https://any-domain.example/nope', index);
    expect(m).toEqual({
      normalizedPath: '/nope',
      pageId: null,
      funnelId: null,
      candidateFunnelIds: [],
      state: 'UNMATCHED',
    });
  });

  it('ignores funnel steps with no pageId instead of throwing', () => {
    const idx = buildPageIndex([{ id: 'p', slug: 's' }], [{ id: 'f', steps: [{}, { pageId: 'p' }] }]);
    expect(matchPath('/s', idx).funnelId).toBe('f');
  });
});
