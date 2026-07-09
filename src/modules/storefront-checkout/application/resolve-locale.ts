const PRIMARY_SUBTAG = /^[a-z]{2}$/;

// Reduce a BCP-47 tag (or a raw value) to its lowercased primary language subtag.
// Returns null when nothing valid is present; the email render path clamps unknown languages to en.
export function normalizeLocale(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const primary = raw.trim().toLowerCase().split(/[-_]/)[0];
  return PRIMARY_SUBTAG.test(primary) ? primary : null;
}

// Browsers list the most-preferred language first; q-weights only break ties between
// already-ordered entries, so the first tag is the buyer's primary language.
export function localeFromAcceptLanguage(header: string | null | undefined): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.split(';')[0];
  return normalizeLocale(first);
}

// Checkout language: an explicit client-provided value wins (the funnel page knows its language),
// otherwise fall back to the request's Accept-Language. null means "no signal" → en downstream.
export function resolveCheckoutLocale(input: {
  explicit?: string | null;
  acceptLanguage?: string | null;
}): string | null {
  return normalizeLocale(input.explicit) ?? localeFromAcceptLanguage(input.acceptLanguage);
}
