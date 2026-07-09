import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  // getTenantPrisma() builds an extended client via getBasePrisma().$extends();
  // returning the same mock keeps configEntry.findUnique observable through it.
  const mock: any = { configEntry: { findUnique: vi.fn() } };
  mock.$extends = () => mock;
  return { prismaMock: mock };
});

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  default: prismaMock,
  getBasePrisma: () => prismaMock,
  getRequestDb: () => undefined,
}));
vi.mock('@/lib/runtime/env', () => ({
  readEnv: () => undefined, isCloudflareRuntime: () => false, getBinding: () => undefined,
}));
vi.mock('@/lib/services/credentials-crypto', () => ({
  encryptCredentials: (v: unknown) => JSON.stringify(v),
  decryptCredentials: (v: string) => JSON.parse(v),
}));

import { setCache } from '@/lib/adapters/cache';
import { MemoryCacheAdapter } from '@/lib/adapters/cache/memory';
import { listActivePaymentProvidersWithCredentials, PAYMENT_KV_KEY } from '@/lib/config/payment';

beforeEach(() => {
  vi.clearAllMocks();
  setCache(new MemoryCacheAdapter());
});

it('reads the payment config doc once and returns active providers with decrypted credentials', async () => {
  prismaMock.configEntry.findUnique.mockResolvedValue({
    value: {
      providers: {
        PAYPAL: { id: 'pp', provider: 'PAYPAL', name: 'PayPal', credentials: JSON.stringify({ clientId: 'cid' }), settings: null, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        STRIPE: { id: 'st', provider: 'STRIPE', name: 'Stripe', credentials: JSON.stringify({ pk: 'pk_x' }), settings: null, isActive: false, createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
      },
    },
  });

  const active = await listActivePaymentProvidersWithCredentials();

  expect(active).toHaveLength(1);
  expect(active[0].provider).toBe('PAYPAL');
  expect(active[0].credentials).toEqual({ clientId: 'cid' });
  // One logical doc read = one tenant row + one global-scope row (2 DB reads). The guard is
  // that the doc is read once, not once per provider (which would be 4 reads for 2 providers).
  expect(prismaMock.configEntry.findUnique).toHaveBeenCalledTimes(2);
});
