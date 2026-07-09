import { describe, it, expect } from 'vitest';
import { CodeSnippetConfig } from '@/components/builder/blocks/CodeSnippet';

describe('CodeSnippetConfig', () => {
  it('exposes borderStyle as a radio with solid/dashed/none', () => {
    const bs = (CodeSnippetConfig.fields as any).borderStyle;
    expect(bs.type).toBe('radio');
    const values = bs.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['solid', 'dashed', 'none']));
  });

  it('exposes showCopyButton as a radio (true/false)', () => {
    const scb = (CodeSnippetConfig.fields as any).showCopyButton;
    expect(scb.type).toBe('radio');
  });

  it('defaults to dashed border + copy button on', () => {
    expect(CodeSnippetConfig.defaultProps.borderStyle).toBe('dashed');
    expect(CodeSnippetConfig.defaultProps.showCopyButton).toBe(true);
  });
});
