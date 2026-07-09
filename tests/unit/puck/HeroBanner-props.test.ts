import { describe, it, expect } from 'vitest';
import { HeroPanelConfig } from '@/components/builder/blocks/HeroPanel';

describe('HeroPanel orthogonal props (post-audit)', () => {
  it('exposes imagePosition as a radio with 5 options', () => {
    const f = (HeroPanelConfig.fields as any).imagePosition;
    expect(f.type).toBe('radio');
    const values = f.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['left', 'right', 'top', 'bottom', 'background']));
  });

  it('exposes contentAlign as a radio with left/center/right', () => {
    const f = (HeroPanelConfig.fields as any).contentAlign;
    expect(f.type).toBe('radio');
    const values = f.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['left', 'center', 'right']));
  });

  it('exposes overlayColor, padding, maxWidth as configurable fields', () => {
    expect((HeroPanelConfig.fields as any).overlayColor).toBeDefined();
    expect((HeroPanelConfig.fields as any).padding).toBeDefined();
    expect((HeroPanelConfig.fields as any).maxWidth).toBeDefined();
  });
});
