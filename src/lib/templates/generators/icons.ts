// Self-contained SVG data-URI icons for template seed data. placehold.co renders
// non-ASCII text (✈ ♥ ☎ …) as "?", so symbol slots must ship real vector glyphs.

const svgDataUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// 24x24 stroke paths (lucide-style)
export const GLYPHS = {
  truck:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  dollar:
    '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  returns:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  headset:
    '<path d="M3 13h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z"/><path d="M21 13h-3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-5Z"/><path d="M3 14v-2a9 9 0 0 1 18 0v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  sparkles:
    '<path d="M12 4l1.7 4.6a2 2 0 0 0 1.2 1.2L19.5 11.5l-4.6 1.7a2 2 0 0 0-1.2 1.2L12 19l-1.7-4.6a2 2 0 0 0-1.2-1.2L4.5 11.5l4.6-1.7a2 2 0 0 0 1.2-1.2Z"/><path d="M19 3v3"/><path d="M17.5 4.5h3"/>',
  flask:
    '<path d="M10 2v6.5L4.7 18.4A2 2 0 0 0 6.5 21.5h11a2 2 0 0 0 1.8-3.1L14 8.5V2"/><path d="M8.5 2h7"/><path d="M7 15h10"/>',
  leaf:
    '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  thumbsUp:
    '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  lock:
    '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m5.5 5.5 13 13"/>',
  percent:
    '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  instagram:
    '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function lineIcon(
  glyph: GlyphName,
  options: { stroke: string; background?: string; shape?: 'rounded' | 'circle' | 'none' },
): string {
  const { stroke, background, shape = 'rounded' } = options;
  const bg =
    background && shape !== 'none'
      ? shape === 'circle'
        ? `<circle cx="24" cy="24" r="24" fill="${background}"/>`
        : `<rect width="48" height="48" rx="12" fill="${background}"/>`
      : '';
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">${bg}`
    + `<g transform="translate(12 12)" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[glyph]}</g>`
    + `</svg>`,
  );
}

export function numberBadgeIcon(label: string, color: string, background: string): string {
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">`
    + `<rect width="64" height="64" rx="14" fill="${background}"/>`
    + `<text x="32" y="40" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="700" fill="${color}">${label}</text>`
    + `</svg>`,
  );
}

export function sealIcon(
  lines: [string, string] | [string, string, string],
  options: { background: string; color: string },
): string {
  const { background, color } = options;
  const [big, mid, small] = lines;
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">`
    + `<circle cx="80" cy="80" r="78" fill="${background}"/>`
    + `<circle cx="80" cy="80" r="64" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round"/>`
    + `<text x="80" y="${small ? 74 : 80}" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="${color}">${big}</text>`
    + `<text x="80" y="${small ? 96 : 104}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" letter-spacing="3" fill="${color}">${mid}</text>`
    + (small
      ? `<text x="80" y="114" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" letter-spacing="1" fill="${color}">${small}</text>`
      : '')
    + `</svg>`,
  );
}

export function wordmarkIcon(text: string, color: string, width = 140, height = 40): string {
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<text x="${width / 2}" y="${Math.round(height * 0.68)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="${Math.round(height * 0.55)}" font-weight="600" fill="${color}">${text}</text>`
    + `</svg>`,
  );
}

export function paymentLogoIcon(label: string, background: string): string {
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32" viewBox="0 0 48 32">`
    + `<rect width="48" height="32" rx="5" fill="${background}"/>`
    + `<text x="24" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" font-style="italic" fill="#ffffff">${label}</text>`
    + `</svg>`,
  );
}
