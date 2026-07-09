import { describe, it, expect } from 'vitest';
import { isWellFormedBinding } from './binding';
import type { Binding } from './binding';

describe('Binding', () => {
  it('accepts a VariantRef handle-only binding', () => {
    const b: Binding = { kind: 'VariantRef', externalRef: 'gid://shopify/ProductVariant/1' };
    expect(isWellFormedBinding(b)).toBe(true);
  });
  it('rejects a binding carrying embedded catalog payload', () => {
    const b = { kind: 'ProductRef', externalRef: 'p1', price: 1000 };
    expect(isWellFormedBinding(b as unknown)).toBe(false);
  });
  it('rejects an unknown binding kind', () => {
    expect(isWellFormedBinding({ kind: 'Wat', externalRef: 'x' } as unknown)).toBe(false);
  });
});
