const DEFAULT_MARKETPLACE_BASE_URL = 'https://autonnel.com';
const FETCH_TIMEOUT_MS = 4000;

export interface MarketplaceTemplatePack {
  slug: string;
  title: string;
  tagline: string | null;
  category: string | null;
  priceCents: number;
  heroImage: string | null;
  npmPackage: string | null;
}

interface RawCatalogItem {
  slug?: unknown;
  title?: unknown;
  tagline?: unknown;
  category?: unknown;
  priceCents?: unknown;
  heroImage?: unknown;
  npmPackage?: unknown;
}

// Resolution order: process.env (SSR/Node + test seam) → PUBLIC_ var (Vite inlines
// it into the client bundle) → default. The server config key
// (ConfigKeys.MARKETPLACE_BASE_URL) documents the same default for SSR/SaaS.
function readBaseUrl(): string {
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.MARKETPLACE_BASE_URL : undefined;
  const fromPublic =
    typeof import.meta !== 'undefined'
      ? (import.meta as ImportMeta).env?.PUBLIC_MARKETPLACE_BASE_URL
      : undefined;
  const fromEnv = fromProcess || fromPublic;
  const raw = typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : DEFAULT_MARKETPLACE_BASE_URL;
  return raw.replace(/\/+$/, '');
}

export function getMarketplaceCatalogUrl(): string {
  return readBaseUrl();
}

export function getMarketplaceProductUrl(slug: string): string {
  return `${getMarketplaceCatalogUrl()}/marketplace/${slug}`;
}

function toTemplatePack(raw: RawCatalogItem): MarketplaceTemplatePack | null {
  if (typeof raw.slug !== 'string' || typeof raw.title !== 'string') return null;
  return {
    slug: raw.slug,
    title: raw.title,
    tagline: typeof raw.tagline === 'string' ? raw.tagline : null,
    category: typeof raw.category === 'string' ? raw.category : null,
    priceCents: typeof raw.priceCents === 'number' ? raw.priceCents : 0,
    heroImage: typeof raw.heroImage === 'string' ? raw.heroImage : null,
    npmPackage: typeof raw.npmPackage === 'string' ? raw.npmPackage : null,
  };
}

// Fail-soft: any network/timeout/parse error returns [] so the OSS builder never
// hard-breaks when autonnel.com is unreachable (offline development).
export async function fetchMarketplaceTemplatePacks(
  signal?: AbortSignal,
): Promise<MarketplaceTemplatePack[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${getMarketplaceCatalogUrl()}/api/marketplace/items.json?kind=template`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: unknown };
    if (!Array.isArray(body.items)) return [];
    return body.items
      .map((item) => toTemplatePack(item as RawCatalogItem))
      .filter((p): p is MarketplaceTemplatePack => p !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
