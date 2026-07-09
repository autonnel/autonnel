import type { EmailTemplateType } from './types';
import { TEMPLATE_BUNDLES } from './bundles';
import type { Bundle, SupportedLanguage } from './bundles/_types';
import { applyTextsToDesign } from './apply-texts';
import { compileDesignToHtml } from './compile';

export interface DefaultTemplate {
  name: string;
  subject: string;
  design: unknown;
  content: string;
}

const SUPPORTED_LANGS: ReadonlyArray<SupportedLanguage> = ['en', 'fr', 'de', 'es'];

// Clamps any locale (incl. region-suffixed like `fr-CA` or unsupported like `zh-CN`) to a
// supported template language, falling back to `en`. Used so the rendered copy, the date and the
// currency formatting all share one language instead of leaking the customer's raw locale.
export function resolveTemplateLanguage(language: string | null | undefined): SupportedLanguage {
  const base = (language ?? '').toLowerCase().split('-')[0];
  return (SUPPORTED_LANGS as ReadonlyArray<string>).includes(base) ? (base as SupportedLanguage) : 'en';
}

const inProcessCache = new Map<string, DefaultTemplate>();

export async function buildLocalizedDefault(
  type: EmailTemplateType,
  bundle: Bundle,
  lang: SupportedLanguage,
): Promise<DefaultTemplate> {
  const texts = bundle.texts[lang] ?? bundle.texts.en;
  const localized = applyTextsToDesign(bundle.design, texts);
  const html = await compileDesignToHtml(localized, { cacheKey: `default:${type}:${lang}` });
  return {
    name: bundle.names[lang] ?? bundle.names.en,
    subject: bundle.subjects[lang] ?? bundle.subjects.en,
    design: localized,
    content: html,
  };
}

export async function getDefaultTemplate(
  type: EmailTemplateType,
  language: string = 'en',
): Promise<DefaultTemplate> {
  const lang = resolveTemplateLanguage(language);
  const cacheKey = `${type}:${lang}`;
  const cached = inProcessCache.get(cacheKey);
  if (cached) return cached;

  const bundle = TEMPLATE_BUNDLES[type];
  if (!bundle) throw new Error(`Unknown EmailTemplateType: ${type}`);

  const built = await buildLocalizedDefault(type, bundle, lang);
  inProcessCache.set(cacheKey, built);
  return built;
}

export function getTemplateTypeLabels(): Record<EmailTemplateType, string> {
  const labels = {} as Record<EmailTemplateType, string>;
  for (const [type, bundle] of Object.entries(TEMPLATE_BUNDLES)) {
    labels[type as EmailTemplateType] = bundle.names.en;
  }
  return labels;
}
