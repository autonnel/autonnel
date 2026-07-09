import { readEnv } from '@/lib/runtime/env';
import { getPermissionsAdminIdsRaw } from '@/lib/config/keys';

export const FEATURES = {
  PAGES: 'pages',
  FUNNELS: 'funnels',
  MARKETING: 'marketing',
  PAYMENT: 'payment',
  TRANSACTIONS: 'transactions',
  ORDERS: 'orders',
  ANALYTICS: 'analytics',
  PERMISSIONS: 'permissions',

  PAGES_CREATE: 'pages.create',
  PAGES_EDIT: 'pages.edit',
  PAGES_DELETE: 'pages.delete',

  FUNNELS_CREATE: 'funnels.create',
  FUNNELS_EDIT: 'funnels.edit',
  FUNNELS_DELETE: 'funnels.delete',

  MARKETING_CREATE: 'marketing.create',
  MARKETING_EDIT: 'marketing.edit',
  MARKETING_DELETE: 'marketing.delete',

  PAYMENT_REFUND: 'payment.refund',

  ORDERS_VIEW: 'orders.view',
  ORDERS_REFUND: 'orders.refund',
  ORDERS_EMAILS: 'orders.emails',

  SETTINGS: 'settings',
  SETTINGS_BRANDING: 'settings.branding',
  SETTINGS_LOCALIZATION: 'settings.localization',
  SETTINGS_STORAGE: 'settings.storage',
  SETTINGS_DOMAINS: 'settings.domains',
  SETTINGS_CUSTOM_CODE: 'settings.custom-code',
  SETTINGS_EMAIL: 'settings.email',
  SETTINGS_PAYMENT: 'settings.payment',
  SETTINGS_ECOMMERCE: 'settings.ecommerce',
  SETTINGS_RECALL: 'settings.recall',
  SETTINGS_COUPON: 'settings.coupon',
  SETTINGS_LLM: 'settings.llm',
  SETTINGS_GOOGLE_MAPS: 'settings.google-maps',
  SETTINGS_NOTIFICATIONS: 'settings.notifications',
  SETTINGS_AI_CONVERSION_ANALYSIS: 'settings.ai-conversion-analysis',
  SETTINGS_MAINTENANCE: 'settings.maintenance',
  SETTINGS_BROWSER_RENDERING: 'settings.browser-rendering',
} as const;

export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_LABELS: Record<FeatureId, string> = {
  [FEATURES.PAGES]: 'Pages',
  [FEATURES.FUNNELS]: 'Funnels',
  [FEATURES.MARKETING]: 'Marketing',
  [FEATURES.PAYMENT]: 'Payment',
  [FEATURES.TRANSACTIONS]: 'Transactions',
  [FEATURES.ORDERS]: 'Orders',
  [FEATURES.ANALYTICS]: 'Analytics',
  [FEATURES.PERMISSIONS]: 'Permissions',

  [FEATURES.PAGES_CREATE]: 'Pages: Create',
  [FEATURES.PAGES_EDIT]: 'Pages: Edit',
  [FEATURES.PAGES_DELETE]: 'Pages: Delete',

  [FEATURES.FUNNELS_CREATE]: 'Funnels: Create',
  [FEATURES.FUNNELS_EDIT]: 'Funnels: Edit',
  [FEATURES.FUNNELS_DELETE]: 'Funnels: Delete',

  [FEATURES.MARKETING_CREATE]: 'Marketing: Create',
  [FEATURES.MARKETING_EDIT]: 'Marketing: Edit',
  [FEATURES.MARKETING_DELETE]: 'Marketing: Delete',

  [FEATURES.PAYMENT_REFUND]: 'Payment: Refunds',

  [FEATURES.ORDERS_VIEW]: 'Orders: View',
  [FEATURES.ORDERS_REFUND]: 'Orders: Refund',
  [FEATURES.ORDERS_EMAILS]: 'Orders: Emails',

  [FEATURES.SETTINGS]: 'Settings',
  [FEATURES.SETTINGS_BRANDING]: 'Settings: Branding',
  [FEATURES.SETTINGS_LOCALIZATION]: 'Settings: Localization',
  [FEATURES.SETTINGS_STORAGE]: 'Settings: Storage',
  [FEATURES.SETTINGS_DOMAINS]: 'Settings: Domains',
  [FEATURES.SETTINGS_CUSTOM_CODE]: 'Settings: Custom Code',
  [FEATURES.SETTINGS_EMAIL]: 'Settings: Email',
  [FEATURES.SETTINGS_PAYMENT]: 'Settings: Payment',
  [FEATURES.SETTINGS_ECOMMERCE]: 'Settings: Ecommerce',
  [FEATURES.SETTINGS_RECALL]: 'Settings: Recall',
  [FEATURES.SETTINGS_COUPON]: 'Settings: Coupon',
  [FEATURES.SETTINGS_LLM]: 'Settings: LLM',
  [FEATURES.SETTINGS_GOOGLE_MAPS]: 'Settings: Google Maps',
  [FEATURES.SETTINGS_NOTIFICATIONS]: 'Settings: Notifications',
  [FEATURES.SETTINGS_AI_CONVERSION_ANALYSIS]: 'Settings: AI Conversion Analysis',
  [FEATURES.SETTINGS_MAINTENANCE]: 'Settings: Maintenance',
  [FEATURES.SETTINGS_BROWSER_RENDERING]: 'Settings: Browser Rendering',
};

export const FEATURE_DESCRIPTIONS: Record<FeatureId, string> = {
  [FEATURES.PAGES]: 'Access the Pages top-level menu',
  [FEATURES.FUNNELS]: 'Access the Funnels top-level menu',
  [FEATURES.MARKETING]: 'Access the Marketing top-level menu',
  [FEATURES.PAYMENT]: 'Access the Payment top-level menu',
  [FEATURES.TRANSACTIONS]: 'View payment transactions',
  [FEATURES.ORDERS]: 'Access the Orders top-level menu',
  [FEATURES.ANALYTICS]: 'Access the Analytics top-level menu',
  [FEATURES.PERMISSIONS]: 'Manage roles and permissions (admin-only)',

  [FEATURES.PAGES_CREATE]: 'Create new pages',
  [FEATURES.PAGES_EDIT]: 'Edit existing pages',
  [FEATURES.PAGES_DELETE]: 'Delete pages',

  [FEATURES.FUNNELS_CREATE]: 'Create new funnels',
  [FEATURES.FUNNELS_EDIT]: 'Edit existing funnels',
  [FEATURES.FUNNELS_DELETE]: 'Delete funnels',

  [FEATURES.MARKETING_CREATE]: 'Create ad platform connections',
  [FEATURES.MARKETING_EDIT]: 'Edit ad platform connections',
  [FEATURES.MARKETING_DELETE]: 'Delete ad platform connections',

  [FEATURES.PAYMENT_REFUND]: 'Issue refunds via payment provider',

  [FEATURES.ORDERS_VIEW]: 'View orders',
  [FEATURES.ORDERS_REFUND]: 'Refund orders',
  [FEATURES.ORDERS_EMAILS]: 'View and resend order emails',

  [FEATURES.SETTINGS]: 'Access global settings',
  [FEATURES.SETTINGS_BRANDING]: 'Manage display name, favicon and logo',
  [FEATURES.SETTINGS_LOCALIZATION]: 'Set the site-wide default timezone',
  [FEATURES.SETTINGS_STORAGE]: 'Configure S3 / CDN storage and static domain',
  [FEATURES.SETTINGS_DOMAINS]: 'Manage bound domains',
  [FEATURES.SETTINGS_CUSTOM_CODE]: 'Manage global custom code',
  [FEATURES.SETTINGS_EMAIL]: 'Manage email config and templates',
  [FEATURES.SETTINGS_PAYMENT]: 'Manage payment provider configurations',
  [FEATURES.SETTINGS_ECOMMERCE]: 'Manage ecommerce backend (Shopify, WooCommerce)',
  [FEATURES.SETTINGS_RECALL]: 'Configure abandoned cart recall',
  [FEATURES.SETTINGS_COUPON]: 'Manage coupons',
  [FEATURES.SETTINGS_LLM]: 'Configure OpenAI-compatible LLM (base URL, API key, model)',
  [FEATURES.SETTINGS_GOOGLE_MAPS]: 'Manage Google Maps API key',
  [FEATURES.SETTINGS_NOTIFICATIONS]: 'Configure notification channel pairings (email, Slack, webhook) that route MQ events',
  [FEATURES.SETTINGS_AI_CONVERSION_ANALYSIS]: 'Configure AI conversion analysis prompt and frequency',
  [FEATURES.SETTINGS_MAINTENANCE]: 'Toggle storefront maintenance mode and set bypass password',
  [FEATURES.SETTINGS_BROWSER_RENDERING]: 'Configure Cloudflare Browser Rendering for higher-fidelity page imports',
};

export const NAV_FEATURE_MAP: Record<string, FeatureId> = {
  pages: FEATURES.PAGES,
  funnels: FEATURES.FUNNELS,
  marketing: FEATURES.MARKETING,
  payment: FEATURES.PAYMENT,
  orders: FEATURES.ORDERS,
  analytics: FEATURES.ANALYTICS,
  settings: FEATURES.SETTINGS,
  permissions: FEATURES.PERMISSIONS,
};


export const VIRTUAL_ADMIN_ROLE_ID = '__admin__';
export const VIRTUAL_ADMIN_ROLE_NAME = 'Admin';

function parseIds(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

// Sync env-only for callers that cannot await (e.g. Sidebar.astro frontmatter).
export function getPermissionAdminIds(): string[] {
  return parseIds(readEnv('PERMISSIONS_ADMIN_USER_IDS'));
}

export async function getPermissionAdminIdsAsync(): Promise<string[]> {
  const raw = await getPermissionsAdminIdsRaw();
  return parseIds(raw);
}
