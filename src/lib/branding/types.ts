
export interface FaviconVariants {
  'favicon.ico'?: string;
  'favicon-16x16.png'?: string;
  'favicon-32x32.png'?: string;
  'apple-touch-icon.png'?: string;
  'android-chrome-192x192.png'?: string;
  'android-chrome-512x512.png'?: string;
  [key: string]: string | undefined;
}

export interface FaviconJson {
  source: string;
  variants: FaviconVariants;
}

export interface LogoJson {
  source: string;
  url: string;
}

export type FaviconValue = FaviconJson | string | null | undefined;
export type LogoValue = LogoJson | { url?: string; variants?: Record<string, string> } | string | null | undefined;

export function normalizeFavicon(value: FaviconValue): FaviconJson | null {
  if (!value) return null;
  if (typeof value === 'string') return { source: value, variants: {} };
  if (typeof value === 'object' && 'source' in value) {
    return { source: value.source ?? '', variants: value.variants ?? {} };
  }
  return null;
}

export function normalizeLogo(value: LogoValue): LogoJson | null {
  if (!value) return null;
  if (typeof value === 'string') return { source: value, url: value };
  if (typeof value === 'object') {
    const url = (value as { url?: string }).url ?? '';
    const source = (value as { source?: string }).source ?? url;
    if (!url && !source) return null;
    return { source: source || url, url: url || source };
  }
  return null;
}
