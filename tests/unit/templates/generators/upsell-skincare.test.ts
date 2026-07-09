import { describe, it, expect } from 'vitest';
import { getTemplateData, getTemplateByValue } from '@/lib/templates';

describe('UPSELL_SKINCARE template', () => {
  it('is registered as funnel section with defaultPageType UPSELL', () => {
    const t = getTemplateByValue('UPSELL_SKINCARE');
    expect(t).toBeDefined();
    expect(t!.section).toBe('funnel');
    expect(t!.defaultPageType).toBe('UPSELL');
    expect(t!.thumbnail).toBe('/template-thumbnails/upsell-skincare.png');
  });

  it('contains the expected top-level components in order', () => {
    const data = getTemplateData('UPSELL_SKINCARE');
    const types = data.content.map((c: any) => c.type);
    expect(types).toEqual([
      'UpsellHeader',
      'RichTextBlock',
      'ImageTextSplit',
      'ImageTextSplit',
      'ImageTextSplit',
      'ImageTextSplit',
      'UpsellAddButton',
    ]);
  });
});
