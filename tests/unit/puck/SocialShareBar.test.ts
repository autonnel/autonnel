import { describe, it, expect } from 'vitest';
import { SocialShareRowConfig } from '@/components/builder/blocks/SocialShareRow';

describe('SocialShareRowConfig', () => {
  it('exposes platforms as an array field with platform variants', () => {
    const platforms = (SocialShareRowConfig.fields as any).platforms;
    expect(platforms.type).toBe('array');
    expect(platforms.arrayFields.platform).toBeDefined();
  });

  it('exposes iconStyle as a radio with filled/outline/flat', () => {
    const iconStyle = (SocialShareRowConfig.fields as any).iconStyle;
    expect(iconStyle.type).toBe('radio');
    const values = iconStyle.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['filled', 'outline', 'flat']));
  });

  it('exposes align as a radio with left/center/right', () => {
    const align = (SocialShareRowConfig.fields as any).align;
    expect(align.type).toBe('radio');
    const values = align.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['left', 'center', 'right']));
  });

  it('default platforms include facebook + twitter + instagram + pinterest', () => {
    const defaults = SocialShareRowConfig.defaultProps.platforms.map((p: any) => p.platform);
    expect(defaults).toEqual(expect.arrayContaining(['facebook', 'twitter', 'instagram', 'pinterest']));
  });
});
