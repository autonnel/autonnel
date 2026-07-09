import { describe, it, expect } from 'vitest';
import { ReviewListConfig } from '@/components/builder/blocks/ReviewList';

describe('ReviewList orthogonal props (post-audit)', () => {
  it('exposes columns as a number field (1-4)', () => {
    const f = (ReviewListConfig.fields as any).columns;
    expect(f.type).toBe('number');
    expect(f.min).toBe(1);
    expect(f.max).toBe(4);
  });

  it('exposes cardStyle as a radio with plain/bordered/shadow', () => {
    const f = (ReviewListConfig.fields as any).cardStyle;
    expect(f.type).toBe('radio');
    const values = f.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['plain', 'bordered', 'shadow']));
  });

  it('exposes showAvatar, showStars, showName, showRole as radios', () => {
    expect((ReviewListConfig.fields as any).showAvatar.type).toBe('radio');
    expect((ReviewListConfig.fields as any).showStars.type).toBe('radio');
    expect((ReviewListConfig.fields as any).showName.type).toBe('radio');
    expect((ReviewListConfig.fields as any).showRole.type).toBe('radio');
  });

  it('exposes cards-grid as a fourth theme value (preset layered on orthogonal props)', () => {
    const f = (ReviewListConfig.fields as any).theme;
    const values = f.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['list', 'hero', 'carousel', 'cards-grid']));
  });
});
