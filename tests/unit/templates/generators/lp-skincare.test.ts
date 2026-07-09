import { describe, it, expect } from 'vitest';
import { getTemplateData, getTemplateByValue } from '@/lib/templates';

describe('LP_SKINCARE template', () => {
  it('is registered as funnel section with defaultPageType CUSTOM', () => {
    const t = getTemplateByValue('LP_SKINCARE');
    expect(t).toBeDefined();
    expect(t!.section).toBe('funnel');
    expect(t!.defaultPageType).toBe('CUSTOM');
    expect(t!.thumbnail).toBe('/template-thumbnails/lp-skincare.png');
  });

  it('contains the expected top-level components in order', () => {
    const data = getTemplateData('LP_SKINCARE');
    const types = data.content.map((c: any) => c.type);
    expect(types).toEqual([
      'HeroPanel',
      'FeatureIconRow',
      'ImageTextSplit',
      'RichTextBlock',
      'FeatureIconRow',
      'CallToActionBanner',
      'ImageTextSplit',
      'FeatureIconRow',
      'HowToSteps',
      'FaqAccordion',
      'ReviewList',
      'CallToActionBanner',
      'PageFooter',
    ]);
  });
});
