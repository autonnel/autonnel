


import type { User } from '@prisma/client';
import type { Hooks } from '@/lib/hooks/hooks';
import type { TenantContext } from '@/lib/tenant/types';
import type { PaymentProviderRegistration } from '@/lib/adapters/payment/registry';
import type { PaymentProviderPort } from '@/modules/payments/application/ports/outbound';

export type {
  PaymentProviderPort, PaymentRequestContext, ProviderCreateIntentInput, ProviderCreateIntentResult,
  ProviderOffSessionChargeInput, ProviderCaptureResult, ProviderConfirmResult, ProviderRefundResult,
  ParsedWebhook, IntentAmountHint, WebhookAck,
} from '@/modules/payments/application/ports/outbound';
export type { PaymentProviderRegistration, PaymentFormFieldSpec } from '@/lib/adapters/payment/registry';

// Keyed by the provider slug, which must equal `registration.dbProvider` (e.g. 'ACME').
export interface PluginPaymentProvider {
  registration: PaymentProviderRegistration;
  create(config: Record<string, string>, runtime: PluginRuntime): PaymentProviderPort;
}
export type PaymentProviderFactory = PluginPaymentProvider;


export interface AuthProvider {
  name: string;

  verifySession(request: Request): Promise<User | null>;

  renderLoginExtras?: () => Promise<string | undefined> | string | undefined;
}

export type EmailProviderFactory = (...args: unknown[]) => unknown;
export type EcommerceProviderFactory = (...args: unknown[]) => unknown;
export type AdsProviderFactory = (...args: unknown[]) => unknown;

export interface PluginRoute {
  pattern: string;
  entrypoint: string;
}

export interface ConfigKeyDef {
  key: string;
  envFallback: string;
}

export type AutonnelHooks = Partial<Hooks>;


export interface Banner {
  id: string;
  message: string;
  kind?: 'info' | 'warning' | 'error';
  actionLabel?: string;
  actionHref?: string;
}


export interface PolicyHooks {
  canEditMaintenance?: (ctx: TenantContext) => boolean | Promise<boolean>;
  maxCustomDomains?: (ctx: TenantContext) => number | Promise<number>;



  bypassStorefrontDomainCheck?: (request: Request) => boolean | Promise<boolean>;


  storageBannerEnabled?: () => boolean | Promise<boolean>;
  getGlobalBanners?: (ctx: TenantContext) => Promise<Banner[]> | Banner[];
}


export interface ComponentRef {
  entrypoint: string;
}


export interface MenuItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
}


export interface UiSlots {
  'settings.storage.replace'?: ComponentRef;
  'settings.menu.append'?: MenuItem[];
  'sidebar.system.append'?: MenuItem[];
  'settings.domains.afterForm'?: ComponentRef;
  'maintenance.toggle.tooltip'?: ComponentRef;
  'topbar.org.name'?: ComponentRef;
  'nav.hidden'?: string[];
}

export type SingleValueSlotId =
  | 'settings.storage.replace'
  | 'settings.domains.afterForm'
  | 'maintenance.toggle.tooltip'
  | 'topbar.org.name';

export type ListSlotId =
  | 'settings.menu.append'
  | 'sidebar.system.append'
  | 'nav.hidden';


export interface AdsPlatformField {
  key: string;
  label: string;
  placeholder?: string;
}

export interface AdsPlatformMeta {
  id: 'FACEBOOK' | 'TIKTOK' | 'GOOGLE_ADS' | 'BING_ADS' | string;
  label: string;

  mode: 'token' | 'oauth';
  fields?: AdsPlatformField[];
  oauthAuthorizeUrl?: string;
}

export interface PluginPuckComponent {
  config: import('@puckeditor/core').Config['components'][string];
  category?: string;
  load?: () => Promise<import('react').ComponentType<any>>;
  schema?: { allowedZones: string[]; requiredProps: string[] };
  fullWidth?: boolean;
}

export interface PluginTemplate {
  value: string;
  label: string;
  subtitle?: string;
  section: 'funnel' | 'store' | 'utility';
  defaultPageType: 'CUSTOM' | 'CHECKOUT' | 'UPSELL' | 'THANKYOU' | 'ERROR';
  defaultSlug?: string;
  thumbnail?: string;
  data?: import('@puckeditor/core').Data;
  generator?: () => import('@puckeditor/core').Data;
  requires?: string[];
}

// The bundle-bound members (component render/load, template data/generator/thumbnail)
// reach the app bundle via the virtual module re-export of `builderEntry`, never
// through the plugin object.
export interface BuilderExtension {
  name?: string;
  puckComponents?: Record<string, PluginPuckComponent>;
  templates?: PluginTemplate[];
}

export interface PluginConversion {
  kind: 'purchase' | 'upsell';
  // Stable per conversion across event redelivery: the saleRef, or `${saleRef}-upsell-${n}`.
  conversionId: string;
  saleRef: string;
  amountMinor: number;
  currencyCode: string;
  funnelId?: string;
  // The buyer's tracked page URLs (with query), newest first, deduplicated.
  visitedUrls: string[];
  occurredAt: string;
}

export interface PluginFetchInit {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface PluginLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// Core capabilities handed to plugin callbacks so plugins never import core runtime modules.
// Eventually consistent (Workers KV in production), no atomic operations, read errors return null.
// Only for data that may be lost and rebuilt.
export interface PluginCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PluginRuntime {
  getConfig<T = unknown>(key: string): Promise<T | undefined>;
  // Durable, deduplicated by idempotencyKey, retried with backoff by the core job poll.
  enqueueJob(kind: string, idempotencyKey: string, payload: unknown): Promise<void>;
  // SSRF-guarded outbound fetch.
  fetch(url: string, init?: PluginFetchInit): Promise<Response>;
  // Prisma delegate for one of this plugin's own schemaExtension models, scoped to the current tenant.
  model(name: string): PluginModelDelegate;
  // Scoped to this plugin and the current tenant.
  cache: PluginCache;
  // Settings plus decrypted credentials of a payment provider registered by this plugin.
  paymentConfig(slug: string): Promise<Record<string, string>>;
  logger: PluginLogger;
}

export interface PluginModelDelegate {
  findMany(args?: any): Promise<any[]>;
  findFirst(args?: any): Promise<any | null>;
  findUnique(args: any): Promise<any | null>;
  count(args?: any): Promise<number>;
  create(args: any): Promise<any>;
  createMany(args: any): Promise<{ count: number }>;
  update(args: any): Promise<any>;
  updateMany(args: any): Promise<{ count: number }>;
  upsert(args: any): Promise<any>;
  delete(args: any): Promise<any>;
  deleteMany(args?: any): Promise<{ count: number }>;
}

export interface PluginCron {
  // Must start with `plugin.`; also names the sweep's lock and last-run marker.
  name: string;
  // The worker ticks every 5 minutes, so that is the effective floor.
  intervalMs: number;
  // Defaults to the interval.
  lockTtlSeconds?: number;
  run: (runtime: PluginRuntime) => Promise<void>;
}

// Throwing marks the attempt failed and schedules a retry.
export type PluginJobHandler = (payload: unknown, runtime: PluginRuntime) => Promise<unknown>;

export interface PluginSettingsField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'toggle';
  placeholder?: string;
  help?: string;
  required?: boolean;
  defaultValue?: string | boolean;
}

export type PluginSettingsValues = Record<string, string | boolean>;

export interface PluginSettingsPanel {
  // URL slug: /settings/plugins/<id>
  id: string;
  title: string;
  description?: string;
  // One AppConfig key holding every field as a JSON object.
  configKey: string;
  fields: PluginSettingsField[];
  // Returns an error message, or null when the values are acceptable.
  validate?: (values: PluginSettingsValues) => string | null;
  // Recent jobs of these kinds are listed on the panel page as a delivery log.
  jobKinds?: string[];
}

export interface AutonnelPlugin {
  name: string;
  version: string;
  onConversion?: (conversion: PluginConversion, runtime: PluginRuntime) => Promise<void>;
  // Kinds must start with `plugin.` so they cannot shadow core job kinds.
  jobHandlers?: Record<string, PluginJobHandler>;
  crons?: PluginCron[];
  settingsPanels?: PluginSettingsPanel[];
  authProvider?: AuthProvider;
  hooks?: AutonnelHooks;
  policyHooks?: PolicyHooks;
  uiSlots?: UiSlots;
  paymentProviders?: Record<string, PaymentProviderFactory>;
  emailProviders?: Record<string, EmailProviderFactory>;
  ecommerceProviders?: Record<string, EcommerceProviderFactory>;
  adsProviders?: Record<string, AdsProviderFactory>;
  adsPlatforms?: AdsPlatformMeta[];

  puckComponents?: Record<string, PluginPuckComponent>;
  templates?: PluginTemplate[];
  // Import specifier of the './builder' subpath module supplying the bundle-bound members.
  builderEntry?: string;
  engines?: { autonnel?: string };

  // Prisma DSL with new model / enum blocks only. Every model needs `tenantId String` and may not
  // reference core models. Composed into the deployment schema by `autonnel schema:compose`.
  schemaExtension?: string;
  routes?: PluginRoute[];
  configKeys?: ConfigKeyDef[];
}
