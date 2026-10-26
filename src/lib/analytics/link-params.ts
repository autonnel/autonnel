declare global {
  interface Window {
    __AUTONNEL_LINK_PARAMS__?: Record<string, string>;
  }
}

// Identity travels on the domain-scoped anid cookie and `_ad` is the operator-only
// depth deep link, so neither may follow a visitor onto the next page. Everything
// else -- ad click ids above all -- has to survive every hop, or the conversion
// postback fires without the click id that paid for the visit.
const BLOCKED_PARAMS = new Set(['anid', 'goid', '_ad']);

// Hand-written and imported pages routinely stash the real CTA target in a data
// attribute and navigate with `location.href = el.dataset.url`, which no anchor
// rewrite can reach. A name whitelist, not a value heuristic: a data attribute
// holding an image or an API endpoint must stay byte-identical, and only the name
// distinguishes them. An unlisted name still loses the click id -- add it here.
export const LINK_DATA_ATTRS = [
  'data-url',
  'data-href',
  'data-link',
  'data-target-url',
  'data-checkout-url',
  'data-buy-url',
] as const;

export const LINK_DATA_ATTR_SELECTOR = LINK_DATA_ATTRS.map((name) => `[${name}]`).join(',');

const NON_NAVIGATIONAL_HREF = /^(?:#|mailto:|tel:|sms:|javascript:|data:|blob:)/i;
const FORWARDABLE_PROTOCOLS = new Set(['http:', 'https:']);
const ABSOLUTE_HREF = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function collectPropagatedParams(
  search: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  const params: Record<string, string> = {};
  new URLSearchParams(search).forEach((value, key) => {
    if (BLOCKED_PARAMS.has(key) || key in params) return;
    params[key] = value;
  });
  for (const [key, value] of Object.entries(extra)) {
    if (BLOCKED_PARAMS.has(key) || key in params) continue;
    params[key] = value;
  }
  return params;
}

export function isPropagatableHref(href: string): boolean {
  const raw = href.trim();
  return raw.length > 0 && !NON_NAVIGATIONAL_HREF.test(raw);
}

// Returns the rewritten href, or null when there is nothing to do (non-navigational
// or every param already present) so callers keep the original attribute untouched
// instead of normalizing it.
//
// Cross-origin targets ARE rewritten: a funnel's money link routinely points at the
// merchant's own store on another domain, and stopping at the origin boundary drops
// the click id on exactly the hop that has to carry it.
export function applyParamsToHref(
  href: string,
  params: Record<string, string>,
  baseHref: string,
): string | null {
  const raw = href.trim();
  if (!isPropagatableHref(raw)) return null;

  let target: URL;
  try {
    target = new URL(raw, baseHref);
  } catch {
    return null;
  }
  if (!FORWARDABLE_PROTOCOLS.has(target.protocol)) return null;

  let changed = false;
  for (const [key, value] of Object.entries(params)) {
    if (target.searchParams.has(key)) continue;
    target.searchParams.set(key, value);
    changed = true;
  }
  if (!changed) return null;

  // A relative href stays relative: rewriting it to an absolute URL would pin the
  // link to the current host, which breaks multi-domain tenants.
  return ABSOLUTE_HREF.test(raw)
    ? target.toString()
    : `${target.pathname}${target.search}${target.hash}`;
}

// SSR-injected params that are not in the visitor's URL (funnel context on HTML pages).
export function readExtraLinkParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const raw = window.__AUTONNEL_LINK_PARAMS__;
  if (!raw || typeof raw !== 'object') return {};
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value) params[key] = value;
  }
  return params;
}

// Entry point for script-driven navigation, where no anchor exists to decorate.
export function withPropagatedParams(href: string): string {
  if (typeof window === 'undefined') return href;
  const current = window.location.href;
  const params = collectPropagatedParams(window.location.search, readExtraLinkParams());
  return applyParamsToHref(href, params, current) ?? href;
}
