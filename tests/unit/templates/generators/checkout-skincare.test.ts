import { describe, it, expect } from 'vitest';
import { getTemplateData, getTemplateByValue } from '@/lib/templates';

describe('CHECKOUT_SKINCARE template', () => {
  it('is registered as funnel section with defaultPageType CHECKOUT', () => {
    const t = getTemplateByValue('CHECKOUT_SKINCARE');
    expect(t).toBeDefined();
    expect(t!.section).toBe('funnel');
    expect(t!.defaultPageType).toBe('CHECKOUT');
    expect(t!.thumbnail).toBe('/template-thumbnails/checkout-skincare.png');
  });

  it('contains the expected top-level components in order', () => {
    const data = getTemplateData('CHECKOUT_SKINCARE');
    const types = data.content.map((c: any) => c.type);
    expect(types).toEqual(['ColumnLayout', 'CallToActionBanner']);
  });
});
