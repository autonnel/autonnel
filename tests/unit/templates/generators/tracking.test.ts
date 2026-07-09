import { describe, it, expect } from 'vitest';
import { getTemplateData, getTemplateByValue } from '@/lib/templates';

describe('TRACKING template', () => {
  it('is registered as utility section with defaultSlug "tracking"', () => {
    const t = getTemplateByValue('TRACKING');
    expect(t).toBeDefined();
    expect(t!.section).toBe('utility');
    expect(t!.defaultSlug).toBe('tracking');
  });

  it('generates an OrderTracking + SiteFooter Puck Data', () => {
    const data = getTemplateData('TRACKING');
    expect(data.content).toHaveLength(2);
    expect(data.content[0].type).toBe('OrderTrackingPanel');
    expect(data.content[1].type).toBe('PageFooter');
  });
});
