import type { APIRoute } from 'astro';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/rbac';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getConfig, setConfig, deleteConfig } from '@/lib/config/get-config';
import type {
  EcommerceConfigWire,
  EcommerceProvider,
  FulfillmentMode,
} from '@/contracts/settings';

const KEY = 'ecommerce.config';

interface EcommerceConfigValue {
  provider: EcommerceProvider;
  credentials: Record<string, unknown>;
  isActive?: boolean;
  fulfillmentMode?: FulfillmentMode;
}

function maskCredentials(provider: string, creds: Record<string, unknown>): Record<string, unknown> {
  if (provider === 'SHOPIFY') {
    const token = (creds.accessToken as string) || '';
    return {
      shopDomain: creds.shopDomain || '',
      apiVersion: creds.apiVersion || '',
      accessToken: token ? `${token.slice(0, 4)}••••••••` : '',
      disableNotifications: typeof creds.disableNotifications === 'boolean' ? creds.disableNotifications : true,
    };
  }
  if (provider === 'WOOCOMMERCE') {
    const key = (creds.consumerKey as string) || '';
    const secret = (creds.consumerSecret as string) || '';
    return {
      siteUrl: creds.siteUrl || '',
      apiVersion: creds.apiVersion || '',
      consumerKey: key ? `${key.slice(0, 4)}••••••••` : '',
      consumerSecret: secret ? `${secret.slice(0, 4)}••••••••` : '',
    };
  }
  if (provider === 'PICOCART') {
    const key = (creds.apiKey as string) || '';
    return {
      baseUrl: creds.baseUrl || '',
      apiVersion: creds.apiVersion || '',
      apiKey: key ? `${key.slice(0, 4)}••••••••` : '',
    };
  }
  return {};
}

function validateCredentials(provider: string, credentials: Record<string, unknown> | undefined): string | null {
  if (!credentials || typeof credentials !== 'object') return 'credentials are required';
  if (provider === 'SHOPIFY') {
    if (!credentials.shopDomain) return 'shopDomain is required';
    if (!credentials.accessToken) return 'accessToken is required';
    return null;
  }
  if (provider === 'WOOCOMMERCE') {
    if (!credentials.siteUrl) return 'siteUrl is required';
    if (!credentials.consumerKey) return 'consumerKey is required';
    if (!credentials.consumerSecret) return 'consumerSecret is required';
    return null;
  }
  if (provider === 'PICOCART') {
    if (!credentials.baseUrl) return 'baseUrl is required';
    if (!credentials.apiKey) return 'apiKey is required';
    return null;
  }
  return 'invalid provider';
}

function normalizeFulfillmentMode(value: unknown): FulfillmentMode {
  if (typeof value !== 'string') return 'merged';
  return value.trim().toLowerCase() === 'split' ? 'split' : 'merged';
}

function normalizeProvider(value: unknown): EcommerceProvider {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (v === 'WOOCOMMERCE') return 'WOOCOMMERCE';
  if (v === 'PICOCART') return 'PICOCART';
  return 'SHOPIFY';
}

export const GET = defineRoute('GET /api/ecommerce/config', { feature: 'SETTINGS_ECOMMERCE' }, async (): Promise<EcommerceConfigWire | null> => {
  const config = await getConfig<EcommerceConfigValue>(KEY);
  if (!config) return null;
  const provider = normalizeProvider(config.provider);
  return {
    provider,
    isActive: config.isActive ?? true,
    fulfillmentMode: normalizeFulfillmentMode(config.fulfillmentMode),
    maskedCredentials: maskCredentials(provider, config.credentials || {}),
  };
});

export const PUT = defineRoute('PUT /api/ecommerce/config', { feature: 'SETTINGS_ECOMMERCE' }, async ({ input }): Promise<EcommerceConfigWire> => {
  const { provider, credentials, isActive, fulfillmentMode } = input ?? ({} as Partial<EcommerceConfigValue>);

  if (!provider || !['SHOPIFY', 'WOOCOMMERCE', 'PICOCART'].includes(provider)) {
    throw new ApiError(400, 'Invalid provider. Must be SHOPIFY, WOOCOMMERCE or PICOCART');
  }
  if (fulfillmentMode !== undefined && fulfillmentMode !== 'merged' && fulfillmentMode !== 'split') {
    throw new ApiError(400, 'Invalid fulfillmentMode. Must be merged or split');
  }

  const existing = await getConfig<EcommerceConfigValue>(KEY);
  let nextCredentials: Record<string, unknown> = (credentials as Record<string, unknown>) || {};

  if (existing && normalizeProvider(existing.provider) === provider && credentials && typeof credentials === 'object') {
    const merged: Record<string, unknown> = { ...existing.credentials, ...credentials };
    for (const k of Object.keys(credentials)) {
      const v = (credentials as Record<string, unknown>)[k];
      if ((v === '' || v === undefined) && typeof (existing.credentials as Record<string, unknown>)[k] !== 'boolean') {
        merged[k] = (existing.credentials as Record<string, unknown>)[k];
      }
    }
    nextCredentials = merged;
  } else {
    const err = validateCredentials(provider, credentials as Record<string, unknown>);
    if (err) throw new ApiError(400, err);
  }

  if (provider === 'SHOPIFY' && typeof nextCredentials.disableNotifications !== 'boolean') {
    nextCredentials.disableNotifications = true;
  }

  const value: EcommerceConfigValue = {
    provider,
    credentials: nextCredentials,
    isActive: isActive ?? true,
    fulfillmentMode: normalizeFulfillmentMode(fulfillmentMode ?? existing?.fulfillmentMode ?? 'merged'),
  };
  await setConfig(KEY, value);

  return {
    provider: value.provider,
    isActive: value.isActive ?? true,
    fulfillmentMode: value.fulfillmentMode ?? 'merged',
    maskedCredentials: maskCredentials(value.provider, value.credentials),
  };
});

export const DELETE: APIRoute = withAuth(FEATURES.SETTINGS_ECOMMERCE, async () => {
  await deleteConfig(KEY);
  return jsonResponse({ success: true });
});
