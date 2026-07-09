export interface FaviconVariants {
  'favicon.ico'?: string;
  'favicon-16x16.png'?: string;
  'favicon-32x32.png'?: string;
  'apple-touch-icon.png'?: string;
  'android-chrome-192x192.png'?: string;
  'android-chrome-512x512.png'?: string;
  [key: string]: string | undefined;
}

export interface FaviconLink {
  key: string;
  rel: string;
  type?: string;
  sizes: string;
}

export const FAVICON_LINKS: FaviconLink[] = [
  { key: 'favicon.ico', rel: 'icon', sizes: '32x32' },
  { key: 'favicon-16x16.png', rel: 'icon', type: 'image/png', sizes: '16x16' },
  { key: 'favicon-32x32.png', rel: 'icon', type: 'image/png', sizes: '32x32' },
  { key: 'apple-touch-icon.png', rel: 'apple-touch-icon', sizes: '180x180' },
  { key: 'android-chrome-192x192.png', rel: 'icon', type: 'image/png', sizes: '192x192' },
];

export function buildFaviconTag(link: FaviconLink, href: string): string {
  const typeAttr = link.type ? ` type="${link.type}"` : '';
  return `<link rel="${link.rel}"${typeAttr} sizes="${link.sizes}" href="${href}">`;
}

export function buildFaviconHtml(favicon: { source: string; variants: FaviconVariants } | null): string {
  if (!favicon?.variants) return '';
  return FAVICON_LINKS
    .flatMap((link) => {
      const href = favicon.variants[link.key];
      return href ? [buildFaviconTag(link, href)] : [];
    })
    .join('');
}
