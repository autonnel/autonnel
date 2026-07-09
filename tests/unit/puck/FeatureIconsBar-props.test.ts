import { describe, it, expect } from 'vitest';
import { FeatureIconRowConfig } from '@/components/builder/blocks/FeatureIconRow';

describe('FeatureIconRow orthogonal props (post-audit)', () => {
  it('exposes headerLabel as a text field', () => {
    expect((FeatureIconRowConfig.fields as any).headerLabel).toBeDefined();
  });

  it('exposes iconLayout as a radio with 3 options', () => {
    const f = (FeatureIconRowConfig.fields as any).iconLayout;
    expect(f.type).toBe('radio');
    const values = f.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['icon-only', 'icon-title', 'icon-title-subtitle']));
  });

  it('exposes itemSeparator as a radio (true/false)', () => {
    const f = (FeatureIconRowConfig.fields as any).itemSeparator;
    expect(f.type).toBe('radio');
  });

  it('default iconLayout is icon-title-subtitle', () => {
    expect(FeatureIconRowConfig.defaultProps.iconLayout).toBe('icon-title-subtitle');
  });
});
