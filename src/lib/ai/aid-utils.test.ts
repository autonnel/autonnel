import { describe, it, expect } from 'vitest';
import { tagHtmlWithAids, stripAids } from './aid-utils';

describe('tagHtmlWithAids', () => {
  it('assigns sequential aids in DFS order', () => {
    const html = '<div><h1>A</h1><p>B</p></div><footer>C</footer>';
    const tagged = tagHtmlWithAids(html);
    expect(tagged).toContain('data-aid="a0"');
    expect(tagged).toContain('<h1 data-aid="a1"');
    expect(tagged).toContain('<p data-aid="a2"');
    expect(tagged).toContain('<footer data-aid="a3"');
  });

  it('is idempotent — running twice does not renumber', () => {
    const html = '<div><span>x</span></div>';
    const once = tagHtmlWithAids(html);
    const twice = tagHtmlWithAids(once);
    expect(twice).toBe(once);
  });

  it('does not touch existing data-aid values', () => {
    const html = '<div data-aid="hand-written"><span>x</span></div>';
    const tagged = tagHtmlWithAids(html);
    expect(tagged).toContain('data-aid="hand-written"');
    expect(tagged).toContain('<span data-aid="a0"');
  });
});

describe('stripAids', () => {
  it('removes all data-aid attributes', () => {
    const html = '<div data-aid="a0"><span data-aid="a1">x</span></div>';
    const stripped = stripAids(html);
    expect(stripped).not.toContain('data-aid');
    expect(stripped).toContain('<div><span>x</span></div>');
  });

  it('leaves html without aids untouched', () => {
    const html = '<div><span>x</span></div>';
    expect(stripAids(html)).toBe(html);
  });
});
