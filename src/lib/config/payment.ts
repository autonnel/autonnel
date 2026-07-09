// Each entry's key in the AppConfig KV doc is independent so concurrent writes to PAYPAL and STRIPE cannot lose each other's changes.
export type PaymentProvider = 'PAYPAL' | 'STRIPE';
import {
  getConfig,
  deleteConfig,
  setConfigPath,
  deleteConfigPath,
} from './get-config';
import {
  encryptCredentials,
  decryptCredentials,
} from '@/lib/services/credentials-crypto';

export const PAYMENT_KV_KEY = 'payment.config';

export interface PaymentProviderEntry {
  id: string;
  provider: PaymentProvider;
  name: string;
  credentials: string;
  settings: unknown | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentKvConfig {
  providers: Partial<Record<PaymentProvider, PaymentProviderEntry>>;
}

export interface PaymentProviderPublic {
  id: string;
  provider: PaymentProvider;
  name: string;
  settings: unknown | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentProviderWithCredentials extends PaymentProviderPublic {
  credentials: unknown;
}

export interface UpsertPaymentProviderInput {
  provider: PaymentProvider;
  name: string;
  credentials: unknown;
  settings?: unknown | null;
  isActive?: boolean;
}

function emptyDoc(): PaymentKvConfig {
  return { providers: {} };
}

function newId(): string {
  return `pc_${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`;
}

function toPublic(entry: PaymentProviderEntry): PaymentProviderPublic {
  return {
    id: entry.id,
    provider: entry.provider,
    name: entry.name,
    settings: entry.settings,
    isActive: entry.isActive,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  };
}

export async function getPaymentConfigDoc(): Promise<PaymentKvConfig> {
  const stored = await getConfig<PaymentKvConfig>(PAYMENT_KV_KEY);
  if (!stored || typeof stored !== 'object' || !stored.providers) return emptyDoc();
  return stored;
}

export async function listPaymentProviders(): Promise<PaymentProviderPublic[]> {
  const doc = await getPaymentConfigDoc();
  return Object.values(doc.providers)
    .filter((e): e is PaymentProviderEntry => !!e)
    .map(toPublic)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function getPaymentProviderEntry(
  provider: PaymentProvider,
): Promise<PaymentProviderPublic | null> {
  const doc = await getPaymentConfigDoc();
  const entry = doc.providers[provider];
  return entry ? toPublic(entry) : null;
}

export async function getPaymentProviderEntryWithCredentials(
  provider: PaymentProvider,
): Promise<PaymentProviderWithCredentials | null> {
  const doc = await getPaymentConfigDoc();
  const entry = doc.providers[provider];
  if (!entry) return null;
  return {
    ...toPublic(entry),
    credentials: decryptCredentials(entry.credentials),
  };
}

export async function listActivePaymentProvidersWithCredentials(): Promise<
  PaymentProviderWithCredentials[]
> {
  const doc = await getPaymentConfigDoc();
  return Object.values(doc.providers)
    .filter((e): e is PaymentProviderEntry => !!e && e.isActive)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((entry) => ({
      ...toPublic(entry),
      credentials: decryptCredentials(entry.credentials),
    }));
}

export async function upsertPaymentProvider(
  input: UpsertPaymentProviderInput,
): Promise<PaymentProviderPublic> {
  const doc = await getPaymentConfigDoc();
  const existing = doc.providers[input.provider];
  const now = new Date().toISOString();
  const next: PaymentProviderEntry = {
    id: existing?.id ?? newId(),
    provider: input.provider,
    name: input.name,
    credentials: encryptCredentials(input.credentials),
    settings: input.settings !== undefined ? input.settings : (existing?.settings ?? null),
    isActive: input.isActive ?? existing?.isActive ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await setConfigPath(PAYMENT_KV_KEY, ['providers', input.provider], next);
  return toPublic(next);
}

export async function deletePaymentProvider(provider: PaymentProvider): Promise<void> {
  const doc = await getPaymentConfigDoc();
  if (!doc.providers[provider]) return;
  // Decide whether this is the last provider BEFORE deleteConfigPath runs: getConfig's
  // memo hands back a shared object reference and deleteConfigPath mutates it in place,
  // so reading doc.providers after the delete would undercount and wrongly wipe the whole key.
  const wasLastProvider = Object.keys(doc.providers).filter((p) => p !== provider).length === 0;
  await deleteConfigPath(PAYMENT_KV_KEY, ['providers', provider]);
  if (wasLastProvider) {
    await deleteConfig(PAYMENT_KV_KEY);
  }
}
