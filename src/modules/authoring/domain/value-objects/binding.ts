export type BindingKind = 'ProductRef' | 'VariantRef' | 'DataRef' | 'AssetRef';

export interface Binding {
  kind: BindingKind;
  externalRef: string; // opaque handle only — catalog payload is NEVER stored
}

const KINDS = new Set<BindingKind>(['ProductRef', 'VariantRef', 'DataRef', 'AssetRef']);
const ALLOWED_KEYS = new Set(['kind', 'externalRef']);

export function isWellFormedBinding(value: unknown): value is Binding {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Record<string, unknown>;
  if (!KINDS.has(b.kind as BindingKind)) return false;
  if (typeof b.externalRef !== 'string' || b.externalRef.length === 0) return false;
  // handle-only invariant: no extra keys (no embedded catalog payload)
  return Object.keys(b).every((k) => ALLOWED_KEYS.has(k));
}
