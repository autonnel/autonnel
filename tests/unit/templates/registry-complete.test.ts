import { describe, it, expect } from 'vitest';
import { TEMPLATE_REGISTRY, getTemplatesBySection } from '@/lib/templates';

describe('TEMPLATE_REGISTRY completeness (post-implementation)', () => {
  it('has exactly 11 entries', () => {
    expect(TEMPLATE_REGISTRY).toHaveLength(11);
  });

  it('funnel section has 8 entries (4 new types × 2 themes)', () => {
    expect(getTemplatesBySection('funnel')).toHaveLength(8);
  });

  it('store section is empty in core (store pages moved to @autonnel/template-store-pages)', () => {
    expect(getTemplatesBySection('store')).toHaveLength(0);
  });

  it('utility section has 3 entries (POLICY + TRACKING + ERROR)', () => {
    expect(getTemplatesBySection('utility')).toHaveLength(3);
  });

  it('all funnel and utility entries have a thumbnail path', () => {
    [...getTemplatesBySection('funnel'), ...getTemplatesBySection('utility')].forEach((t) =>
      expect(t.thumbnail).toMatch(/^\/template-thumbnails\//),
    );
  });

  it('values are unique', () => {
    const values = TEMPLATE_REGISTRY.map((t) => t.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
