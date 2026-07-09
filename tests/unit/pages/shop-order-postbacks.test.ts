import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  findByDedup: vi.fn(),
}));

vi.mock('@/composition/make-ads-deps', () => ({
  createAdsDepsForRequest: vi.fn(async () => ({})),
}));

vi.mock('@/composition/make-acquisition-ads', () => ({
  makeAcquisitionAds: vi.fn(async () => ({
    connectionRepo: { list: mocks.list },
    postbackRepo: { findByDedup: mocks.findByDedup },
  })),
}));

import { GET } from '@/pages/api/shop/order/[orderId]/postbacks';

function run(orderId: string | undefined, query = ''): Promise<Response> {
  return (GET as any)({
    params: { orderId },
    url: new URL(`https://shop.example/api/shop/order/${orderId ?? ''}/postbacks${query}`),
    locals: {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/shop/order/:orderId/postbacks', () => {
  it('requires an orderId', async () => {
    const res = await run(undefined);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Order ID is required' });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('returns postback status matched by eventId across connection destinations', async () => {
    mocks.list.mockResolvedValueOnce([
      { id: 'conn_1', platform: 'FACEBOOK', destinations: [{ id: 'dest_1' }] },
    ]);
    mocks.findByDedup.mockResolvedValueOnce({ status: 'SUCCESS', attemptCount: 2 });

    const res = await run('order_1', '?eventId=evt_1');

    expect(res.status).toBe(200);
    expect(mocks.findByDedup).toHaveBeenCalledWith('dest_1', 'evt_1');
    expect(await res.json()).toEqual([
      { connectionId: 'conn_1', platform: 'FACEBOOK', status: 'SUCCESS', attempts: 2 },
    ]);
  });

  it('returns an empty list when no eventId is supplied', async () => {
    mocks.list.mockResolvedValueOnce([
      { id: 'conn_1', platform: 'FACEBOOK', destinations: [{ id: 'dest_1' }] },
    ]);

    const res = await run('order_1');

    expect(res.status).toBe(200);
    expect(mocks.findByDedup).not.toHaveBeenCalled();
    expect(await res.json()).toEqual([]);
  });
});
