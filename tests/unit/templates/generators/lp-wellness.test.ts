import { describe, it, expect } from 'vitest';
import { getTemplateData, getTemplateByValue } from '@/lib/templates';

describe('LP_WELLNESS template', () => {
  it('is registered as funnel section', () => {
    const t = getTemplateByValue('LP_WELLNESS');
    expect(t).toBeDefined();
    expect(t!.section).toBe('funnel');
    expect(t!.thumbnail).toBe('/template-thumbnails/lp-wellness.png');
  });

  it('contains the expected top-level components in order', () => {
    const data = getTemplateData('LP_WELLNESS');
    const types = data.content.map((c: any) => c.type);
    expect(types).toEqual([
      'StoreHeader',
      'HeroPanel',
      'ImageTextSplit',
      'FeatureIconRow',
      'FeatureIconRow',
      'ImageTextSplit',
      'RichTextBlock',
      'FeatureIconRow',
      'ReviewList',
      'ImageTextSplit',
      'FeatureIconRow',
      'CallToActionBanner',
      'PageFooter',
    ]);
  });
});
