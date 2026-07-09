import { describe, it, expect } from 'vitest';
import { getTemplateData, getTemplateByValue } from '@/lib/templates';

describe('THANKYOU_SKINCARE template', () => {
  it('is registered as funnel section with defaultPageType THANKYOU', () => {
    const t = getTemplateByValue('THANKYOU_SKINCARE');
    expect(t).toBeDefined();
    expect(t!.section).toBe('funnel');
    expect(t!.defaultPageType).toBe('THANKYOU');
    expect(t!.thumbnail).toBe('/template-thumbnails/thankyou-skincare.png');
  });

  it('contains the expected top-level components in order', () => {
    const data = getTemplateData('THANKYOU_SKINCARE');
    const types = data.content.map((c: any) => c.type);
    expect(types).toEqual([
      'HeroPanel',
      'OrderDetailPanel',
      'RichTextBlock',
      'MediaGrid',
      'SocialShareRow',
      'PageFooter',
    ]);
  });
});
