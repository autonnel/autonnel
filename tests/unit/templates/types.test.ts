import { describe, it, expect } from 'vitest';
import type { TemplateDescriptor, TemplateSection } from '@/lib/templates/types';

describe('TemplateDescriptor', () => {
  it('accepts a fully populated descriptor', () => {
    const t: TemplateDescriptor = {
      value: 'LP_SKINCARE',
      label: 'Landing Page · Skincare',
      subtitle: 'Cream-focused cosmetics funnel LP',
      section: 'funnel',
      thumbnail: '/template-thumbnails/lp-skincare.png',
      defaultPageType: 'CUSTOM',
      defaultSlug: 'lp-skincare',
      generator: () => ({ root: { props: {} }, content: [], zones: {} }),
    };
    expect(t.value).toBe('LP_SKINCARE');
    expect(t.section).toBe('funnel');
  });

  it('allows thumbnail to be null and defaultSlug to be omitted', () => {
    const t: TemplateDescriptor = {
      value: 'POLICY',
      label: 'Policy Page',
      subtitle: 'Privacy / terms page',
      section: 'utility',
      thumbnail: null,
      defaultPageType: 'CUSTOM',
      generator: () => ({ root: { props: {} }, content: [], zones: {} }),
    };
    expect(t.thumbnail).toBeNull();
    expect(t.defaultSlug).toBeUndefined();
  });

  it('section is one of funnel | store | utility', () => {
    const sections: TemplateSection[] = ['funnel', 'store', 'utility'];
    expect(sections).toHaveLength(3);
  });
});
