import { describe, it, expect } from 'vitest';
import { getTemplateData, getTemplateByValue } from '@/lib/templates';

describe('POLICY template', () => {
  it('is registered as utility section', () => {
    const t = getTemplateByValue('POLICY');
    expect(t).toBeDefined();
    expect(t!.section).toBe('utility');
    expect(t!.defaultPageType).toBe('CUSTOM');
  });

  it('generates Puck Data with a RichText then SiteFooter at root', () => {
    const data = getTemplateData('POLICY');
    expect(data.content).toHaveLength(2);
    expect(data.content[0].type).toBe('RichTextBlock');
    expect(data.content[1].type).toBe('PageFooter');
  });

  it('RichText defaultProps include a Privacy Policy title', () => {
    const data = getTemplateData('POLICY');
    const rt: any = data.content[0];
    expect(rt.props.title).toBe('Privacy Policy');
  });

  it('content is HTML markup, not raw markdown (RichTextBlock renders it as innerHTML)', () => {
    const data = getTemplateData('POLICY');
    const content: string = (data.content[0] as any).props.content;
    expect(content).toContain('<h2>');
    expect(content).not.toMatch(/^#|\n#/);
    expect(content).not.toContain('**');
  });
});
