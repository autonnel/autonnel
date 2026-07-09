import type { FeatureCatalogPort } from '../application/ports/outbound';

// ROLES/ROLE_FEATURES live in Postgres; this list does NOT.
export const FEATURES = Object.freeze([
  'OVERVIEW',
  'PAGES',
  'FUNNELS',
  'ORDERS',
  'ORDERS_REFUND',
  'ORDERS_EMAILS',
  'TRANSACTIONS',
  'PAYMENT',
  'MARKETING',
  'ANALYTICS',
  'API_KEYS',
  'SETTINGS',
  'SETTINGS_USERS',
  'SETTINGS_BRANDING',
  'SETTINGS_LOCALIZATION',
  'SETTINGS_STORAGE',
  'SETTINGS_EMAIL',
  'SETTINGS_PAYMENT',
  'SETTINGS_ECOMMERCE',
  'SETTINGS_RECALL',
  'SETTINGS_LLM',
  'SETTINGS_GOOGLE_MAPS',
  'SETTINGS_NOTIFICATIONS',
  'SETTINGS_AI_CONVERSION_ANALYSIS',
  'SETTINGS_MAINTENANCE',
  'SETTINGS_BROWSER_RENDERING',
  'SETTINGS_DOMAINS',
  'SETTINGS_CUSTOM_CODE',
  'SETTINGS_COUPON',
  'PERMISSIONS',
] as const);

export type StaticFeatureKey = (typeof FEATURES)[number];

export class StaticFeatureCatalog implements FeatureCatalogPort {
  private readonly keys = new Set<string>(FEATURES);
  allKeys(): ReadonlySet<string> {
    return this.keys;
  }
}
