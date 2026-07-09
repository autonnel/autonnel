import { describe, it, expect } from 'vitest';
import { satisfiesRange } from '@/lib/plugins/semver-range';

describe('satisfiesRange', () => {
  const cases: Array<[version: string, range: string, expected: boolean]> = [
    // wildcard / empty -> always
    ['0.1.0', '*', true],
    ['0.1.0', '', true],
    ['9.9.9', '   ', true],
    // pinned
    ['1.2.3', '1.2.3', true],
    ['1.2.3', '1.2.4', false],
    ['1.2.3', 'v1.2.3', true],
    // >=
    ['1.2.3', '>=1.0.0', true],
    ['1.2.3', '>=1.2.3', true],
    ['1.2.3', '>=2.0.0', false],
    // >
    ['1.2.3', '>1.2.2', true],
    ['1.2.3', '>1.2.3', false],
    // caret: ^1.2.3 -> >=1.2.3 <2.0.0
    ['1.2.3', '^1.2.3', true],
    ['1.9.0', '^1.2.3', true],
    ['1.2.2', '^1.2.3', false],
    ['2.0.0', '^1.2.3', false],
    // caret 0.x: ^0.2.3 -> >=0.2.3 <0.3.0
    ['0.2.3', '^0.2.3', true],
    ['0.2.9', '^0.2.3', true],
    ['0.3.0', '^0.2.3', false],
    ['0.1.0', '^0.2.3', false],
    // caret 0.0.x: ^0.0.3 -> >=0.0.3 <0.0.4
    ['0.0.3', '^0.0.3', true],
    ['0.0.4', '^0.0.3', false],
    // tilde: ~1.2.3 -> >=1.2.3 <1.3.0
    ['1.2.3', '~1.2.3', true],
    ['1.2.9', '~1.2.3', true],
    ['1.3.0', '~1.2.3', false],
    ['1.2.2', '~1.2.3', false],
    // unparseable -> false
    ['not-a-version', '>=1.0.0', false],
  ];

  it.each(cases)('satisfiesRange(%s, %s) === %s', (version, range, expected) => {
    expect(satisfiesRange(version, range)).toBe(expected);
  });
});
