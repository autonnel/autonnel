import { describe, it, expect } from 'vitest';
import { CallToActionBannerConfig } from '@/components/builder/blocks/CallToActionBanner';

describe('CallToActionBanner orthogonal props (post-audit)', () => {
  it('exposes badgeImage as a media field', () => {
    expect((CallToActionBannerConfig.fields as any).badgeImage).toBeDefined();
  });

  it('exposes badgePosition as a radio with 4 options', () => {
    const f = (CallToActionBannerConfig.fields as any).badgePosition;
    expect(f.type).toBe('radio');
    const values = f.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['left', 'right', 'top', 'none']));
  });

  it('exposes headline and subheadline as text fields', () => {
    expect((CallToActionBannerConfig.fields as any).headline).toBeDefined();
    expect((CallToActionBannerConfig.fields as any).subheadline).toBeDefined();
  });

  it('keeps existing theme enum (plain/sale-card) for backwards compat', () => {
    const t = (CallToActionBannerConfig.fields as any).theme;
    expect(t.type).toBe('radio');
    const values = t.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['plain', 'sale-card']));
  });
});
