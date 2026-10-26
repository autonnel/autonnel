import { describe, it, expect } from 'vitest';
import { balanceCssBraces } from './css-repair';

describe('balanceCssBraces', () => {
  it('drops a stray closing brace so later rules survive', () => {
    const css = '.a{color:red}\n}\n@media (min-width:768px){.b{top:0}}';
    expect(balanceCssBraces(css)).toBe('.a{color:red}\n\n@media (min-width:768px){.b{top:0}}');
  });

  it('closes blocks left open at the end', () => {
    expect(balanceCssBraces('@media x{.a{color:red}')).toBe('@media x{.a{color:red}}');
  });

  it('ignores braces inside strings and comments', () => {
    const css = '.a::before{content:"}"}/* } */.b{content:\'{\'}';
    expect(balanceCssBraces(css)).toBe(css);
  });

  it('leaves balanced css untouched', () => {
    const css = '.a{background:var(--x)}@media (max-width:1px){.b{top:0}}';
    expect(balanceCssBraces(css)).toBe(css);
  });
});
