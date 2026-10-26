export const CUSTOM_KIND_PREFIX = 'custom:';

// Single source of truth for custom event names, imported by both the browser tracker
// and the server-side ingest domain so the two can never drift apart.
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

export function isValidCustomEventName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

export function toCustomKind(name: string): string {
  return `${CUSTOM_KIND_PREFIX}${name}`;
}

export function isCustomKind(kind: string): boolean {
  return kind.startsWith(CUSTOM_KIND_PREFIX);
}

// null when the kind is not custom, or carries a name ingest would have rejected.
export function customEventNameOf(kind: string): string | null {
  if (!isCustomKind(kind)) return null;
  const name = kind.slice(CUSTOM_KIND_PREFIX.length);
  return isValidCustomEventName(name) ? name : null;
}
