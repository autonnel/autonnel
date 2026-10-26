const LOCALE_TAG: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
};

export function formatMoney(amount: number, currencyCode: string, language: string): string {
  try {
    return new Intl.NumberFormat(LOCALE_TAG[language] ?? 'en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

export function resolvePageLanguage(value: unknown): string {
  return typeof value === 'string' && Object.hasOwn(LOCALE_TAG, value) ? value : 'en';
}
