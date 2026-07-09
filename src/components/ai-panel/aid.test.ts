import { describe, it, expect } from 'vitest';
import { assignAidsToHtml, stripAidsFromHtml } from './aid';
import { tagHtmlWithAids } from '@/lib/ai/aid-utils';

describe('assignAidsToHtml', () => {
  it('produces the same aids as the server tagger for the same html', () => {
    const html = '<div><h1>A</h1><p>B<span>inner</span></p></div><footer>C</footer>';
    const client = assignAidsToHtml(html);
    const server = tagHtmlWithAids(html);
    expect(client).toBe(server);
  });

  it('strips aids round-trip', () => {
    const html = '<div><h1>A</h1></div>';
    const tagged = assignAidsToHtml(html);
    expect(stripAidsFromHtml(tagged)).toBe(html);
  });
});
