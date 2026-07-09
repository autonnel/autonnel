import { describe, it, expect } from 'vitest';
import { PageFooterConfig } from '@/components/builder/blocks/PageFooter';

describe('PageFooter orthogonal visibility props (post-audit)', () => {
  it('exposes showNav, showAbout, showLogo, showCopyright, showSocial as radio fields', () => {
    expect((PageFooterConfig.fields as any).showNav.type).toBe('radio');
    expect((PageFooterConfig.fields as any).showAbout.type).toBe('radio');
    expect((PageFooterConfig.fields as any).showLogo.type).toBe('radio');
    expect((PageFooterConfig.fields as any).showCopyright.type).toBe('radio');
    expect((PageFooterConfig.fields as any).showSocial.type).toBe('radio');
  });

  it('keeps existing theme enum (full/compact)', () => {
    const t = (PageFooterConfig.fields as any).theme;
    const values = t.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['full', 'compact']));
  });
});
