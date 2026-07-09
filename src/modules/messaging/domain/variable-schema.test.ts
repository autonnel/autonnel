import { describe, it, expect } from 'vitest';
import { VariableSchema } from './variable-schema';

describe('VariableSchema', () => {
  it('lists declared variable names', () => {
    const s = VariableSchema.of([
      { name: 'orderNumber', required: true },
      { name: 'firstName', required: false },
    ]);
    expect(s.names()).toEqual(['orderNumber', 'firstName']);
  });

  it('declares() reports whether a name is in the schema', () => {
    const s = VariableSchema.of([{ name: 'orderNumber', required: true }]);
    expect(s.declares('orderNumber')).toBe(true);
    expect(s.declares('unknownVar')).toBe(false);
  });

  it('validate() returns missing required variable names', () => {
    const s = VariableSchema.of([
      { name: 'orderNumber', required: true },
      { name: 'trackingUrl', required: true },
      { name: 'firstName', required: false },
    ]);
    expect(s.validate({ orderNumber: '1001' }).missing).toEqual(['trackingUrl']);
    expect(s.validate({ orderNumber: '1001', trackingUrl: 'x' }).missing).toEqual([]);
  });

  it('rejects duplicate variable names', () => {
    expect(() => VariableSchema.of([{ name: 'a', required: true }, { name: 'a', required: false }])).toThrow(/duplicate/i);
  });
});
