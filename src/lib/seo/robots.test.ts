import { describe, it, expect } from 'vitest';
import { buildRobotsTxt, buildAdminRobotsTxt, NOINDEX_ROBOTS_DIRECTIVE } from './robots';

describe('buildRobotsTxt', () => {
  it('disallows everything when noindex is on', () => {
    expect(buildRobotsTxt(true)).toBe('User-agent: *\nDisallow: /\n');
  });

  it('allows crawling but keeps api paths out when noindex is off', () => {
    const txt = buildRobotsTxt(false);
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Disallow: /api/');
    expect(txt).not.toMatch(/^Disallow: \/$/m);
  });

  it('never allows the admin host to be crawled', () => {
    expect(buildAdminRobotsTxt()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('exposes a directive that blocks indexing, not just crawling', () => {
    expect(NOINDEX_ROBOTS_DIRECTIVE).toContain('noindex');
  });
});
