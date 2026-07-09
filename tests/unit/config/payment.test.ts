import { describe, it, expect, vi, beforeEach } from 'vitest';

const { kvStore } = vi.hoisted(() => ({
  kvStore: new Map<string, unknown>(),
}));

// The mock mirrors the REAL get-config semantics on purpose: getConfig hands back the
// stored object reference (its memo is reference-sharing) and setConfigPath/deleteConfigPath
// mutate that object IN PLACE. An immutable mock would hide reference-aliasing bugs like a
// delete on one provider wiping the whole key, so it must match production behavior.
vi.mock('@/lib/config/get-config', () => ({
  getConfig: vi.fn(async (key: string) => kvStore.get(key) ?? undefined),
  setConfig: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, value);
  }),
  deleteConfig: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
  setConfigPath: vi.fn(async (key: string, path: string[], value: unknown) => {
    const doc: any = kvStore.get(key) ?? {};
    let cursor: any = doc;
    for (let i = 0; i < path.length - 1; i++) {
      const seg = path[i];
      if (cursor[seg] === null || typeof cursor[seg] !== 'object') cursor[seg] = {};
      cursor = cursor[seg];
    }
    cursor[path[path.length - 1]] = value;
    kvStore.set(key, doc);
  }),
  deleteConfigPath: vi.fn(async (key: string, path: string[]) => {
    const doc: any = kvStore.get(key);
    if (!doc) return;
    let cursor: any = doc;
    for (let i = 0; i < path.length - 1; i++) {
      const next = cursor[path[i]];
      if (next === null || typeof next !== 'object') return;
      cursor = next;
    }
    delete cursor[path[path.length - 1]];
    kvStore.set(key, doc);
  }),
}));

import {
  getPaymentConfigDoc,
  getPaymentProviderEntry,
  getPaymentProviderEntryWithCredentials,
  listPaymentProviders,
  upsertPaymentProvider,
  deletePaymentProvider,
} from '@/lib/config/payment';

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('payment KV accessor', () => {
  it('returns empty doc when nothing stored', async () => {
    expect(await getPaymentConfigDoc()).toEqual({ providers: {} });
    expect(await listPaymentProviders()).toEqual([]);
    expect(await getPaymentProviderEntry('PAYPAL')).toBeNull();
  });

  it('upserts a new provider and returns the public entry', async () => {
    const entry = await upsertPaymentProvider({
      provider: 'PAYPAL',
      name: 'PayPal',
      credentials: { clientId: 'c', clientSecret: 's' },
      settings: { mode: 'sandbox' },
      isActive: true,
    });

    expect(entry.id).toMatch(/.+/);
    expect(entry.provider).toBe('PAYPAL');
    expect(entry.name).toBe('PayPal');
    expect(entry.isActive).toBe(true);
    // credentials are not on the public entry
    expect((entry as any).credentials).toBeUndefined();

    const stored = kvStore.get('payment.config') as any;
    expect(stored.providers.PAYPAL.credentials).toBe(
      Buffer.from(JSON.stringify({ clientId: 'c', clientSecret: 's' })).toString('base64'),
    );
  });

  it('preserves the existing entry id on subsequent upserts', async () => {
    const first = await upsertPaymentProvider({
      provider: 'PAYPAL',
      name: 'PayPal',
      credentials: { clientId: 'c1', clientSecret: 's1' },
    });
    const second = await upsertPaymentProvider({
      provider: 'PAYPAL',
      name: 'PayPal Updated',
      credentials: { clientId: 'c2', clientSecret: 's2' },
    });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('PayPal Updated');
  });

  it('keeps providers independent', async () => {
    await upsertPaymentProvider({
      provider: 'PAYPAL',
      name: 'PP',
      credentials: { k: 1 },
    });
    await upsertPaymentProvider({
      provider: 'STRIPE',
      name: 'St',
      credentials: { k: 2 },
    });
    const list = await listPaymentProviders();
    expect(list.map((e) => e.provider).sort()).toEqual(['PAYPAL', 'STRIPE']);
  });

  it('returns decrypted credentials via getPaymentProviderEntryWithCredentials', async () => {
    await upsertPaymentProvider({
      provider: 'STRIPE',
      name: 'St',
      credentials: { secretKey: 'sk_test_x' },
    });
    const got = await getPaymentProviderEntryWithCredentials('STRIPE');
    expect(got?.credentials).toEqual({ secretKey: 'sk_test_x' });
  });

  it('deletes a single provider without touching the other', async () => {
    await upsertPaymentProvider({ provider: 'PAYPAL', name: 'PP', credentials: { a: 1 } });
    await upsertPaymentProvider({ provider: 'STRIPE', name: 'St', credentials: { b: 2 } });
    await deletePaymentProvider('PAYPAL');
    expect(await getPaymentProviderEntry('PAYPAL')).toBeNull();
    expect(await getPaymentProviderEntry('STRIPE')).not.toBeNull();
  });

  // Regression: deleting STRIPE must NOT wipe PAYPAL. deleteConfigPath mutates the shared
  // config doc in place, so the "last provider -> clear whole key" cleanup has to be decided
  // before that mutation, otherwise removing one of two providers nukes the entire key.
  it('deleting one of two providers keeps the other', async () => {
    await upsertPaymentProvider({ provider: 'PAYPAL', name: 'PP', credentials: { a: 1 } });
    await upsertPaymentProvider({ provider: 'STRIPE', name: 'St', credentials: { b: 2 } });
    await deletePaymentProvider('STRIPE');
    expect(await getPaymentProviderEntry('STRIPE')).toBeNull();
    const paypal = await getPaymentProviderEntry('PAYPAL');
    expect(paypal).not.toBeNull();
    expect(paypal?.provider).toBe('PAYPAL');
    expect(kvStore.get('payment.config')).toBeDefined();
  });

  it('deleting the only provider clears the whole key', async () => {
    await upsertPaymentProvider({ provider: 'STRIPE', name: 'St', credentials: { b: 2 } });
    await deletePaymentProvider('STRIPE');
    expect(await getPaymentProviderEntry('STRIPE')).toBeNull();
    expect(kvStore.has('payment.config')).toBe(false);
  });

  it('setting isActive=false flips the flag without losing credentials', async () => {
    await upsertPaymentProvider({ provider: 'PAYPAL', name: 'PP', credentials: { a: 1 } });
    await upsertPaymentProvider({
      provider: 'PAYPAL',
      name: 'PP',
      credentials: { a: 1 },
      isActive: false,
    });
    const got = await getPaymentProviderEntryWithCredentials('PAYPAL');
    expect(got?.isActive).toBe(false);
    expect(got?.credentials).toEqual({ a: 1 });
  });

  // SaaS concurrency regression guard. The whole point of using setConfigPath
  // (vs read-modify-write setConfig) is that two providers can be written
  // concurrently without losing one of them.
  it('concurrent upserts to different providers both survive', async () => {
    await Promise.all([
      upsertPaymentProvider({ provider: 'PAYPAL', name: 'PP', credentials: { a: 1 } }),
      upsertPaymentProvider({ provider: 'STRIPE', name: 'St', credentials: { b: 2 } }),
    ]);
    const list = await listPaymentProviders();
    expect(list.map((e) => e.provider).sort()).toEqual(['PAYPAL', 'STRIPE']);
  });
});
