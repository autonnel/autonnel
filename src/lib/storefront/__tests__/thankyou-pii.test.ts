import { describe, it, expect, vi } from 'vitest';

const orderRow = {
  id: 'order-uuid',
  orderNumber: '1001',
  status: 'PAID',
  capturedTotal: 4999,
  currencyCode: 'USD',
  customerEmail: 'buyer@example.com',
  customerName: 'Buyer Name',
  lines: [{ externalRef: 'v1', title: 'Widget', quantity: 1, unitPriceMinor: 4999, lineTotalMinor: 4999 }],
  attribution: {},
  createdAt: new Date('2026-07-31T00:00:00Z'),
};

vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => ({ order: { findFirst: async () => orderRow } }),
}));

import { getOrderDataForThankYou } from '../storefront-data.service';

describe('getOrderDataForThankYou — contact gating', () => {
  it('omits buyer contact by default', async () => {
    const data = await getOrderDataForThankYou('order-uuid');
    expect(data.orderNumber).toBe('1001');
    expect(data.total).toBe(49.99);
    expect(data.customerEmail).toBeUndefined();
    expect(data.customerName).toBeUndefined();
  });

  it('includes buyer contact only when explicitly permitted', async () => {
    const data = await getOrderDataForThankYou('order-uuid', { includeContact: true });
    expect(data.customerEmail).toBe('buyer@example.com');
    expect(data.customerName).toBe('Buyer Name');
  });

  it('still returns the non-PII order shape so the page can render', async () => {
    const data = await getOrderDataForThankYou('order-uuid');
    expect(data.items).toHaveLength(1);
    expect(data.currency).toBe('USD');
  });
});
