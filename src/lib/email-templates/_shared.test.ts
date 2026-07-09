import { describe, it, expect } from 'vitest';
import { page, section, text, button, headerSection, footerSection, infoBox, callout } from './_shared';

describe('_shared design helpers', () => {
  it('page() returns a Page node with rows', () => {
    const p = page({ backgroundColor: '#f5f5f5', rows: [] });
    expect(p.type).toBe('page');
    expect(p.attributes['background-color']).toBe('#f5f5f5');
    expect(p.children).toEqual([]);
  });

  it('text() applies default attributes (padding, align, line-height)', () => {
    const t = text({ html: 'Hello' });
    expect(t.type).toBe('text');
    expect(t.data.value.content).toBe('Hello');
    expect(t.attributes.padding).toBe('10px 25px');
    expect(t.attributes.align).toBe('left');
    expect(t.attributes['line-height']).toBe('1.6');
  });

  it('button() does NOT include letter-spacing attribute', () => {
    const b = button({ text: 'Click', href: 'https://x.test' });
    expect(b.attributes).not.toHaveProperty('letter-spacing');
  });

  it('section() wraps children in section node', () => {
    const s = section({ padding: '20px', children: [text({ html: 'a' })] });
    expect(s.type).toBe('section');
    expect(s.attributes.padding).toBe('20px');
    expect(s.children).toHaveLength(1);
  });

  it('headerSection / footerSection / infoBox / callout return well-formed nodes', () => {
    expect(headerSection({ text: 'Hi' }).type).toBe('section');
    expect(footerSection({ text: 'Bye' }).type).toBe('section');
    expect(infoBox({ html: 'info' }).type).toBe('text');
    expect(callout({ html: 'note', backgroundColor: '#fef3c7' }).type).toBe('text');
  });
});
