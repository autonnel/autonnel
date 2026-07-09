import { defineRoute, ApiError } from '@/lib/api/define-route';
import {
  getPaymentProviderEntry,
  getPaymentProviderEntryWithCredentials,
  upsertPaymentProvider,
  deletePaymentProvider,
  type PaymentProvider,
  type PaymentProviderPublic,
} from '@/lib/config/payment';
import type { PaymentConfigWire } from '@/contracts/settings';

const VALID_PROVIDERS = ['paypal', 'stripe'] as const;

function normalizeProvider(raw: string | undefined): PaymentProvider {
  if (!raw) throw new ApiError(400, 'Invalid provider');
  const lower = raw.toLowerCase();
  if (!VALID_PROVIDERS.includes(lower as (typeof VALID_PROVIDERS)[number])) throw new ApiError(400, 'Invalid provider');
  return lower.toUpperCase() as PaymentProvider;
}

function toWire(config: PaymentProviderPublic): PaymentConfigWire {
  return {
    id: config.id,
    provider: config.provider,
    name: config.name,
    settings: (config.settings as Record<string, unknown> | null | undefined) ?? null,
    isActive: config.isActive,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export const GET = defineRoute('GET /api/settings/payment/:provider', { feature: 'SETTINGS_PAYMENT' }, async ({ params }): Promise<PaymentConfigWire | null> => {
  const provider = normalizeProvider(params.provider);
  const config = await getPaymentProviderEntry(provider);
  if (!config) return null;
  return toWire(config);
});

export const PUT = defineRoute('PUT /api/settings/payment/:provider', { feature: 'SETTINGS_PAYMENT' }, async ({ params, input }): Promise<PaymentConfigWire> => {
  const provider = normalizeProvider(params.provider);
  const { name, credentials, settings, isActive } = input ?? {};
  if (!credentials) throw new ApiError(400, 'credentials are required');

  const prior = await getPaymentProviderEntryWithCredentials(provider);
  const priorCredentials =
    prior && prior.credentials && typeof prior.credentials === 'object' && !Array.isArray(prior.credentials)
      ? (prior.credentials as Record<string, unknown>)
      : {};
  const mergedCredentials = { ...priorCredentials, ...credentials };

  const result = await upsertPaymentProvider({
    provider,
    name: name || `${provider} configuration`,
    credentials: mergedCredentials,
    settings,
    isActive: isActive ?? true,
  });
  return toWire(result);
});

export const DELETE = defineRoute('DELETE /api/settings/payment/:provider', { feature: 'SETTINGS_PAYMENT' }, async ({ params }) => {
  const provider = normalizeProvider(params.provider);
  const existing = await getPaymentProviderEntry(provider);
  if (!existing) throw new ApiError(404, 'Payment config not found');
  await deletePaymentProvider(provider);
  return { success: true } as const;
});
