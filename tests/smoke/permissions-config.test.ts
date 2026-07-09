import { describe, it, expect } from 'vitest';
import {
  FEATURES,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  NAV_FEATURE_MAP,
  VIRTUAL_ADMIN_ROLE_ID,
  VIRTUAL_ADMIN_ROLE_NAME,
  type FeatureId,
} from '@/lib/rbac/config';

describe('permissions config', () => {
  it('FEATURES catalog includes the core capability ids', () => {
    expect(FEATURES.ORDERS).toBe('orders');
    expect(FEATURES.PAGES).toBe('pages');
    expect(FEATURES.ANALYTICS).toBe('analytics');
    expect(FEATURES.PERMISSIONS).toBe('permissions');
  });

  it('NAV_FEATURE_MAP covers expected nav keys', () => {
    for (const navKey of ['pages', 'funnels', 'marketing', 'payment', 'orders', 'analytics', 'settings', 'permissions']) {
      expect(NAV_FEATURE_MAP[navKey]).toBeDefined();
    }
  });

  it('FEATURE_LABELS has an entry for every FeatureId', () => {
    for (const value of Object.values(FEATURES) as FeatureId[]) {
      expect(FEATURE_LABELS[value], `label for ${value}`).toBeTruthy();
    }
  });

  it('FEATURE_DESCRIPTIONS has an entry for every FeatureId', () => {
    for (const value of Object.values(FEATURES) as FeatureId[]) {
      expect(FEATURE_DESCRIPTIONS[value], `description for ${value}`).toBeTruthy();
    }
  });

  it('virtual admin role identifier and name are defined', () => {
    expect(VIRTUAL_ADMIN_ROLE_ID).toBe('__admin__');
    expect(VIRTUAL_ADMIN_ROLE_NAME).toBe('Admin');
  });
});
