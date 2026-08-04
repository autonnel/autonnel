import { describe, it, expect, vi } from 'vitest';

vi.mock('@/composition/order-fulfillment-deps', () => ({
  makeOrderDashboardQuery: () => ({
    forExport: async () => [
      {
        createdAt: '2026-07-31T10:00:00.000Z',
        orderNumber: '1001',
        status: 'PAID',
        customerName: "=cmd|'/C calc'!A0",
        customerEmail: 'buyer@example.com',
        capturedTotalMinor: 4999,
        currencyCode: 'USD',
        trackingNumber: null,
      },
    ],
  }),
}));

import { GET } from '../export';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';

const ctx = () => ({ url: new URL('http://admin.test/api/order/export'), locals: {} }) as never;

const asUser = (features: string[]) => ({
  kind: 'user' as const,
  userId: 'u1',
  tenantId: 'default',
  permissions: PermissionSet.of(features.map(toFeatureKey)),
});

describe('GET /api/order/export — formula neutralization', () => {
  it('prefixes a buyer-planted formula so it is inert', async () => {
    const res = (await runWithContext({ tenantId: 'default', principal: asUser(['ORDERS']) }, async () =>
      GET(ctx()),
    )) as Response;
    const csv = await res.text();
    expect(csv).toContain(`"'=cmd`);
    expect(csv).not.toMatch(/,"=cmd/);
  });

  it('still requires the ORDERS feature', async () => {
    const res = (await runWithContext({ tenantId: 'default', principal: asUser([]) }, async () =>
      GET(ctx()),
    )) as Response;
    expect(res.status).toBe(403);
  });
});
