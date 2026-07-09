
export type EditorChoice = 'PUCK' | 'HTML';

export interface PanelProps {
  onCancel: () => void;
  onBack: () => void;
  onCreated: (page: any) => void;
  redirectAfterCreate: boolean;
  defaultPageType?: string;
}

export async function extractErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = await response.json();
    return (data as any).error || fallback;
  } catch {
    return fallback;
  }
}

export const SECTION_META: Record<
  'funnel' | 'store' | 'utility',
  { title: string; subtitle: string }
> = {
  funnel: {
    title: 'Funnel Pages',
    subtitle:
      'Templates for the main funnel flow: landing → checkout → upsell → thank-you',
  },
  store: {
    title: 'Store Pages',
    subtitle: 'E-commerce homepage and category-listing templates',
  },
  utility: {
    title: 'Utility Pages',
    subtitle: 'Order tracking, policy, and error-handling pages',
  },
};

export const MARKETPLACE_SECTION_META = {
  title: 'Marketplace',
  subtitle: 'Premium template packs — purchase on autonnel.com, then install via npm',
};

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const SLUG_SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomSlugSuffix(length = 4): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SLUG_SUFFIX_ALPHABET[Math.floor(Math.random() * SLUG_SUFFIX_ALPHABET.length)];
  }
  return out;
}

export function applySlugSuffix(base: string, suffix: string): string {
  return base ? `${base}-${suffix}` : base;
}
