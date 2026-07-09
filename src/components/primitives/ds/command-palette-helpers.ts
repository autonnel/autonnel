export type PaletteItemKind = 'navigate' | 'funnel' | 'site' | 'order' | 'action';

export interface PaletteItem {
  id: string;
  kind: PaletteItemKind;
  label: string;
  hint?: string;
  href?: string;
  keywords?: string[];
  group: 'Navigate' | 'Funnels' | 'Sites' | 'Orders' | 'Actions';
}

export interface PaletteData {
  funnels: Array<{ id: string; name: string }>;
  sites: Array<{ id: string; name: string }>;
}

const NAV_ITEMS: PaletteItem[] = [
  { id: 'nav-overview', kind: 'navigate', label: 'Overview', href: '/overview', group: 'Navigate', keywords: ['dashboard', 'home'] },
  { id: 'nav-pages', kind: 'navigate', label: 'Pages', href: '/pages', group: 'Navigate' },
  { id: 'nav-funnels', kind: 'navigate', label: 'Funnels', href: '/funnels', group: 'Navigate' },
  { id: 'nav-orders', kind: 'navigate', label: 'Orders', href: '/orders', group: 'Navigate' },
  { id: 'nav-orders-emails', kind: 'navigate', label: 'Email queue', href: '/orders/emails', group: 'Navigate', keywords: ['emails', 'queue'] },
  { id: 'nav-payment', kind: 'navigate', label: 'Payment', href: '/payment', group: 'Navigate' },
  { id: 'nav-marketing', kind: 'navigate', label: 'Marketing', href: '/marketing', group: 'Navigate' },
  { id: 'nav-analytics', kind: 'navigate', label: 'Analytics', href: '/analytics', group: 'Navigate' },
  { id: 'nav-settings', kind: 'navigate', label: 'Settings', href: '/settings/branding', group: 'Navigate' },
  { id: 'nav-llm', kind: 'navigate', label: 'LLM settings', href: '/settings/llm', group: 'Navigate', keywords: ['ai', 'openai', 'model'] },
  { id: 'nav-integrations', kind: 'navigate', label: 'Integrations settings', href: '/settings/integrations', group: 'Navigate', keywords: ['google', 'maps', 'address', 'autocomplete', 'browser', 'rendering', 'cloudflare', 'import'] },
  { id: 'nav-permissions', kind: 'navigate', label: 'Permissions', href: '/settings/permissions', group: 'Navigate', keywords: ['roles', 'users'] },
];

const ACTION_ITEMS: PaletteItem[] = [
  { id: 'act-new-funnel', kind: 'action', label: 'New funnel', hint: 'Create funnel', href: '/funnels?new=1', group: 'Actions', keywords: ['create', 'add'] },
  { id: 'act-connect-platform', kind: 'action', label: 'Connect platform', hint: 'Add an integration', href: '/marketing', group: 'Actions', keywords: ['integration', 'oauth'] },
  { id: 'act-logout', kind: 'action', label: 'Logout', hint: 'Sign out of admin', href: '/logout', group: 'Actions', keywords: ['signout', 'sign out'] },
];

export function buildPaletteItems(data: PaletteData, query: string): PaletteItem[] {
  const navigate = NAV_ITEMS;
  const funnels: PaletteItem[] = data.funnels.slice(0, 10).map((f) => ({
    id: `funnel-${f.id}`,
    kind: 'funnel',
    label: f.name || f.id,
    hint: f.id,
    href: `/funnel/${f.id}/pages`,
    group: 'Funnels',
    keywords: [f.id],
  }));
  const sites: PaletteItem[] = data.sites.slice(0, 10).map((s) => ({
    id: `site-${s.id}`,
    kind: 'site',
    label: s.name || s.id,
    hint: s.id,
    href: `/site/${s.id}/pages`,
    group: 'Sites',
    keywords: [s.id],
  }));

  const orderHits = parseOrderQuery(query);
  const orders: PaletteItem[] = orderHits.map((q) => ({
    id: `order-${q}`,
    kind: 'order',
    label: `Order ${q}`,
    hint: 'Open order search',
    href: `/orders?q=${encodeURIComponent(q)}`,
    group: 'Orders',
    keywords: [q],
  }));

  return [...navigate, ...funnels, ...sites, ...orders, ...ACTION_ITEMS];
}

export function parseOrderQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (!/^[a-z0-9-_]+$/i.test(trimmed)) return [];
  if (trimmed.length < 3) return [];
  return [trimmed];
}

export function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  const idx = h.indexOf(n);
  if (idx >= 0) return 60 - idx;
  let i = 0;
  let score = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, i);
    if (found < 0) return 0;
    score += 5 - Math.min(4, found - i);
    i = found + 1;
  }
  return Math.max(1, score);
}

export function filterAndRank(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim();
  if (!q) return items;
  const scored = items
    .map((item) => {
      const corpus = [item.label, item.hint ?? '', ...(item.keywords ?? [])].join(' ');
      return { item, score: fuzzyScore(corpus, q) };
    })
    .filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

export function groupItems(items: PaletteItem[]): Array<{ group: PaletteItem['group']; items: PaletteItem[] }> {
  const order: PaletteItem['group'][] = ['Navigate', 'Funnels', 'Sites', 'Orders', 'Actions'];
  const map = new Map<PaletteItem['group'], PaletteItem[]>();
  for (const item of items) {
    const arr = map.get(item.group) ?? [];
    arr.push(item);
    map.set(item.group, arr);
  }
  return order
    .filter((g) => map.has(g))
    .map((group) => ({ group, items: map.get(group)! }));
}

export function nextIndex(current: number, total: number, dir: 1 | -1): number {
  if (total === 0) return 0;
  return (current + dir + total) % total;
}

export const __NAV_ITEMS = NAV_ITEMS;
export const __ACTION_ITEMS = ACTION_ITEMS;
