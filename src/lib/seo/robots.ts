// Single source of truth for the "discourage search engines" switch. robots.txt only asks
// crawlers not to FETCH; a URL linked from elsewhere can still be indexed from the link alone,
// so the same switch also emits the noindex directive (meta tag + X-Robots-Tag header) that
// actually keeps pages out of the index.
export const NOINDEX_ROBOTS_DIRECTIVE = 'noindex, nofollow';

export function buildRobotsTxt(noindex: boolean): string {
  if (noindex) {
    return 'User-agent: *\nDisallow: /\n';
  }
  return 'User-agent: *\nDisallow: /api/\nAllow: /\n';
}

// The admin UI must never be crawlable regardless of the storefront switch.
export function buildAdminRobotsTxt(): string {
  return 'User-agent: *\nDisallow: /\n';
}
