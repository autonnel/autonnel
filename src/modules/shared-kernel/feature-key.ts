declare const brand: unique symbol;
export type FeatureKey = string & { readonly [brand]: 'FeatureKey' };

export function toFeatureKey(value: string): FeatureKey {
  if (!value || !/^[A-Z][A-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid FeatureKey: ${value}`);
  }
  return value as FeatureKey;
}

export function isFeatureKey(value: string): value is FeatureKey {
  return /^[A-Z][A-Z0-9_]*$/.test(value);
}
