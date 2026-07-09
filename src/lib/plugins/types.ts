


import type { User } from '@prisma/client';
import type { Hooks } from '@/lib/hooks/hooks';
import type { TenantContext } from '@/lib/tenant/types';


export interface AuthProvider {
  name: string;

  verifySession(request: Request): Promise<User | null>;

  renderLoginExtras?: () => Promise<string | undefined> | string | undefined;
}

export type PaymentProviderFactory = (...args: unknown[]) => unknown;
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

export interface AutonnelPlugin {
  name: string;
  version: string;
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

  // Plugins MUST NOT mutate core models; they may only declare new models

  schemaExtension?: string;
  routes?: PluginRoute[];
  configKeys?: ConfigKeyDef[];
}
