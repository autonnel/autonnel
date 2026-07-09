import { describe, it, expect } from 'vitest';
import { getTemplateData, getTemplateByValue } from '@/lib/templates';

describe('UPSELL_WELLNESS template', () => {
  it('is registered as funnel section with defaultPageType UPSELL', () => {
    const t = getTemplateByValue('UPSELL_WELLNESS');
    expect(t).toBeDefined();
    expect(t!.section).toBe('funnel');
    expect(t!.defaultPageType).toBe('UPSELL');
    expect(t!.thumbnail).toBe('/template-thumbnails/upsell-wellness.png');
  });

  it('contains the expected top-level components in order', () => {
    const data = getTemplateData('UPSELL_WELLNESS');
    const types = data.content.map((c: any) => c.type);
    expect(types).toEqual([
      'StepProgress',
      'RichTextBlock',
      'ColumnLayout',
      'FeatureIconRow',
    ]);
  });
});
