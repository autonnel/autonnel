import { describe, it, expect } from 'vitest';
import { csvCell } from '../csv';

describe('csvCell', () => {
  it('quotes an ordinary value', () => {
    expect(csvCell('Buyer Name')).toBe('"Buyer Name"');
  });

  it('escapes embedded double quotes', () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it.each(['=', '+', '-', '@'])('neutralizes a leading %s', (trigger) => {
    expect(csvCell(`${trigger}cmd|'/C calc'!A0`)).toBe(`"'${trigger}cmd|'/C calc'!A0"`);
  });

  it('neutralizes a trigger hidden behind leading whitespace', () => {
    expect(csvCell('   =1+1')).toBe(`"'   =1+1"`);
  });

  it('neutralizes a trigger behind a leading tab', () => {
    expect(csvCell('\t=1+1')).toBe(`"'\t=1+1"`);
  });

  it('neutralizes a trigger behind a leading carriage return', () => {
    expect(csvCell('\r=1+1')).toBe(`"'\r=1+1"`);
  });

  it('leaves a hyphen alone when it is not the first significant character', () => {
    expect(csvCell('Order -1 of 3')).toBe('"Order -1 of 3"');
  });

  it('handles an empty value', () => {
    expect(csvCell('')).toBe('""');
  });

  it('handles a whitespace-only value', () => {
    expect(csvCell('   ')).toBe('"   "');
  });

  it('neutralizes a formula that also contains quotes', () => {
    expect(csvCell('=HYPERLINK("http://evil","click")')).toBe(
      `"'=HYPERLINK(""http://evil"",""click"")"`,
    );
  });
});
