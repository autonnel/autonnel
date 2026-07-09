import { describe, it, expect } from 'vitest';
import { getTemplateData as legacyGetTemplateData } from '@/components/builder/template-data';
import { getTemplateData as registryGetTemplateData } from '@/lib/templates';

describe('legacy getTemplateData bridges to new registry', () => {
  it.each(['POLICY', 'TRACKING', 'ERROR'])(
    'returns registry data for %s',
    (key) => {
      const legacy = legacyGetTemplateData(key);
      const registry = registryGetTemplateData(key);
      expect(legacy).toEqual(registry);
    },
  );
});
