export const ICONS: Record<string, string> = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  pages:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  funnels:
    '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
  orders:
    '<path d="M5 7h14l-1.5 11a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
  payment:
    '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/>',
  transactions:
    '<path d="M3 7h18"/><path d="M3 12h18"/><path d="M3 17h18"/><path d="M7 4l-4 3l4 3"/><path d="M17 14l4 3l-4 3"/>',
  marketing:
    '<path d="M3 11v3a4 4 0 0 0 4 4h3l5 4V3l-5 4H7a4 4 0 0 0-4 4z"/>',
  analytics:
    '<path d="M3 3v18h18"/><path d="M7 14l4-4l3 3l5-6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3a1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  'credit-card':
    '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/>',
  billing:
    '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/>',
  docs:
    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  changelog:
    '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};

export function svg(id: string): string {
  const inner = ICONS[id] || '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">${inner}</svg>`;
}
