// Shared by checkout SSR and the browser; the query string is attacker-controlled.
export const VARIANT_QUERY_PARAM = 'variant';
// Plain tokens (WooCommerce ids, Shopify numeric ids, Picocart cuids) plus full Shopify-style
// variant GIDs, which is what the Shopify and Picocart backends use as the variant ref.
export const VARIANT_ID_PATTERN = /^(?:[A-Za-z0-9_-]{1,64}|gid:\/\/shopify\/ProductVariant\/[A-Za-z0-9_-]{1,64})$/;
export const SHOPIFY_VARIANT_GID_PREFIX = 'gid://shopify/ProductVariant/';
// Caps catalog fan-out per request.
export const MAX_PRESELECTED_VARIANTS = 10;

export function parseVariantIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (!VARIANT_ID_PATTERN.test(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_PRESELECTED_VARIANTS) break;
  }
  return out;
}

// A plain id also matches the GID ending in it, so a link can carry the short form.
export function variantIdMatches(variantRef: string, requestedId: string): boolean {
  if (variantRef === requestedId) return true;
  return !requestedId.startsWith(SHOPIFY_VARIANT_GID_PREFIX) && variantRef === `${SHOPIFY_VARIANT_GID_PREFIX}${requestedId}`;
}

export function variantRefCandidates(requestedId: string): string[] {
  return requestedId.startsWith(SHOPIFY_VARIANT_GID_PREFIX) ? [requestedId] : [requestedId, `${SHOPIFY_VARIANT_GID_PREFIX}${requestedId}`];
}

export function pickPreselectedId(itemIds: string[], requestedIds: string[]): string | null {
  for (const requested of requestedIds) {
    const hit = itemIds.find((id) => variantIdMatches(id, requested));
    if (hit) return hit;
  }
  return null;
}
