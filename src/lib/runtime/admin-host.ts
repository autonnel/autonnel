import { readEnv } from '@/lib/runtime/env';

// ADMIN_DOMAIN accepts a comma-separated list; each entry may use '*' as a
// single-label wildcard (e.g. "*.example.com" matches "admin.example.com" but
// not the apex or a deeper subdomain).
export function adminHostPatterns(): string[] {
  const value = readEnv('ADMIN_DOMAIN');
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function normalizeHost(host: string | null): string | null {
  if (!host) return null;
  return host.split(':')[0].trim().toLowerCase() || null;
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wildcarded = escaped.replace(/\\\*/g, '[^.]*');
  return new RegExp(`^${wildcarded}$`);
}

function matchesPattern(host: string, pattern: string): boolean {
  if (!pattern.includes('*')) return host === pattern;
  return patternToRegExp(pattern).test(host);
}

// Returns true only when ADMIN_DOMAIN is configured AND host matches one of its
// patterns; an unset ADMIN_DOMAIN yields false.
export function hostMatchesAdminPattern(host: string | null): boolean {
  const patterns = adminHostPatterns();
  if (patterns.length === 0) return false;
  const normalized = normalizeHost(host);
  if (normalized === null) return false;
  return patterns.some((pattern) => matchesPattern(normalized, pattern));
}

// The admin UI is served ONLY on hosts matching ADMIN_DOMAIN; every other host
// (including when ADMIN_DOMAIN is unset) serves the storefront. This is the safe
// failure mode for a commerce product: a wiped/misconfigured ADMIN_DOMAIN shows
// shoppers/ad-landings/crawlers the storefront (admin merely becomes unreachable,
// which the operator notices at once) rather than a login screen on every domain.
// ADMIN_DOMAIN is thus REQUIRED to reach the admin (local dev uses "localhost").
export function isAdminHost(host: string | null): boolean {
  return hostMatchesAdminPattern(host);
}

export const PUBLIC_STOREFRONT_PREFIXES: string[] = [
  '/storefront/',
  '/n/',
  '/_errors/',
  '/_astro/',
  '/_image',
  '/_server-islands/',
  '/_actions/',
  '/api/shop/',
  '/api/checkout/',
  '/api/recall/',
  '/api/media',
  '/api/marketing/beacon', // public conversion-tracking beacon, must stay reachable on storefront hosts
  '/api/health',
  '/favicon',
  '/robots.txt',
  '/sitemap',
];

// Root '/' is intentionally NOT public here: on a frontend host the middleware
// rewrites '/' to the storefront homepage, so it must fall through this guard
// rather than pass through to the admin index page.
export function isPublicStorefrontPath(pathname: string): boolean {
  if (PUBLIC_STOREFRONT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return /\.[a-z0-9]+$/i.test(pathname);
}
