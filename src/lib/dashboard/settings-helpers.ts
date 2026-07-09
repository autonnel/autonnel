
export type SettingsTab =
  | 'branding'
  | 'localization'
  | 'domains'
  | 'custom-code'
  | 'storage'
  | 'llm'
  | 'integrations'
  | 'email'
  | 'email-templates'
  | 'payment'
  | 'ecommerce'
  | 'recall'
  | 'maintenance'
  | 'coupons'
  | 'users'
  | 'permissions'
  | 'api-keys'
  | 'logs';

export type SettingsGroup = 'site' | 'communication' | 'commerce' | 'access' | 'system';

export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'default';

export const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; description: string; group: SettingsGroup }> = [
  { id: 'branding',         label: 'Branding',             description: 'Display name, favicon and logo',         group: 'site' },
  { id: 'localization',     label: 'Localization',         description: 'Site-wide default timezone',             group: 'site' },
  { id: 'domains',          label: 'Domains',              description: 'Bound domains for the storefront',       group: 'site' },
  { id: 'custom-code',      label: 'Custom Code',          description: 'Global custom code injected on every page', group: 'site' },
  { id: 'storage',          label: 'Storage',              description: 'S3 / CDN configuration and static domain', group: 'site' },
  { id: 'llm',              label: 'LLM',                  description: 'OpenAI-compatible base URL, API key, and model', group: 'site' },
  { id: 'integrations',     label: 'Integrations',         description: 'Google Maps and Browser Rendering', group: 'site' },
  { id: 'email',            label: 'Email Provider',       description: 'SMTP or Resend provider',                group: 'communication' },
  { id: 'email-templates',  label: 'Email Templates',      description: 'Multi-language transactional templates', group: 'communication' },
  { id: 'recall',           label: 'Recall',               description: 'Abandoned cart recovery',                group: 'communication' },
  { id: 'maintenance',      label: 'Maintenance',          description: 'Block storefront traffic with optional bypass password', group: 'system' },
  { id: 'payment',          label: 'Payment',              description: 'Payment provider configuration',         group: 'commerce' },
  { id: 'ecommerce',        label: 'Headless Ecommerce',   description: 'Shopify / WooCommerce backend',          group: 'commerce' },
  { id: 'coupons',          label: 'Coupons',              description: 'Discount code library',                  group: 'commerce' },
  { id: 'users',            label: 'Users',                description: 'Admin users + invitations',              group: 'access' },
  { id: 'permissions',      label: 'Roles & Permissions',  description: 'Define roles and feature access',        group: 'access' },
  { id: 'api-keys',         label: 'API keys',             description: 'Programmatic access tokens',             group: 'access' },
  { id: 'logs',             label: 'Logs',                 description: 'Recent system events',                   group: 'system' },
];

export const SETTINGS_GROUP_LABELS: Record<SettingsGroup, string> = {
  site: 'Site',
  communication: 'Communication',
  commerce: 'Commerce',
  access: 'Access',
  system: 'System',
};

const VALID_TABS = new Set<SettingsTab>([
  'branding', 'localization', 'domains', 'custom-code', 'storage', 'llm', 'integrations',
  'email', 'email-templates', 'recall', 'maintenance',
  'payment', 'ecommerce', 'coupons',
  'users', 'permissions', 'api-keys', 'logs',
]);

export function resolveSettingsTab(value: string | null | undefined): SettingsTab {
  const v = (value || 'branding').toLowerCase();
  if (VALID_TABS.has(v as SettingsTab)) return v as SettingsTab;
  if (v === 'apikeys' || v === 'keys') return 'api-keys';
  if (v === 'roles') return 'permissions';
  return 'branding';
}

export function statusBadgeClasses(tone: Tone): string {
  switch (tone) {
    case 'ok':   return 'bg-ds-okBg border-ds-okBorder text-ds-okText';
    case 'warn': return 'bg-ds-warnBg border-ds-warnBorder text-ds-warnText';
    case 'bad':  return 'bg-ds-badBg border-ds-badBorder text-ds-badText';
    case 'muted': return 'bg-ds-surface2 border-ds-line text-ds-muted';
    default:     return 'bg-ds-surface2 border-ds-line text-ds-slate';
  }
}

export function httpStatusTone(status: number | null | undefined): Tone {
  if (status == null) return 'muted';
  if (status >= 500) return 'bad';
  if (status >= 400) return 'warn';
  if (status >= 200 && status < 300) return 'ok';
  return 'default';
}

export interface SystemInfo {
  version: string;
  runtime: 'node' | 'cloudflare' | 'unknown';
  runtimeLabel: string;
  dbProvider: string;
  dbConnected: boolean;
  totalPages: number;
  totalFunnels: number;
  totalUsers: number;
  totalOrders: number;
}

export function describeRuntime(isCloudflare: boolean): { runtime: SystemInfo['runtime']; runtimeLabel: string } {
  if (isCloudflare) return { runtime: 'cloudflare', runtimeLabel: 'Cloudflare Workers' };
  if (typeof process !== 'undefined' && process.versions?.node) {
    return { runtime: 'node', runtimeLabel: `Node ${process.versions.node}` };
  }
  return { runtime: 'unknown', runtimeLabel: 'Unknown runtime' };
}

export function maskDbUrl(url: string | null | undefined): string {
  if (!url) return 'not configured';
  try {
    const u = new URL(url);
    const proto = u.protocol.replace(':', '');
    const host = u.hostname || 'localhost';
    const port = u.port ? `:${u.port}` : '';
    const db = u.pathname.replace(/^\//, '');
    return `${proto}://${host}${port}/${db}`;
  } catch {
    return 'configured';
  }
}

export function describeDbProvider(url: string | null | undefined): string {
  if (!url) return 'unknown';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'PostgreSQL';
  if (url.startsWith('mysql://')) return 'MySQL';
  if (url.startsWith('sqlite:') || url.startsWith('file:')) return 'SQLite';
  return 'unknown';
}

export interface ApiKeyView {
  id: string;
  name: string;
  maskedKey: string;
  writeAccess: boolean;
  isActive: boolean;
  expiresAt: Date | string | null;
  createdAt: Date | string;
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 10) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function apiKeyExpiryTone(expiresAt: Date | string | null | undefined, now: Date = new Date()): Tone {
  if (!expiresAt) return 'muted';
  const ts = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  if (!isFinite(ts)) return 'muted';
  const diffMs = ts - now.getTime();
  if (diffMs < 0) return 'bad';
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (diffMs < sevenDaysMs) return 'warn';
  return 'ok';
}

export interface LogRow {
  id: string;
  provider: string;
  method: string;
  endpoint: string;
  statusCode: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
  orderId: string | null;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
