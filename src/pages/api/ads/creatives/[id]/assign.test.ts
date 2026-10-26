import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  assign: vi.fn(async () => undefined),
  createAdsDepsForRequest: vi.fn(async () => ({})),
}));

vi.mock('@/modules/identity/application/principal-resolution', () => ({
  requireFeature: h.requireFeature,
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock('@/composition/make-ads-deps', () => ({ createAdsDepsForRequest: h.createAdsDepsForRequest }));
vi.mock('@/composition/make-acquisition-ads', () => ({
  makeAcquisitionAds: vi.fn(async () => ({ assignAdFunnel: { assign: h.assign } })),
}));

import { POST } from './assign';

function ctx(id: string, body: unknown): any {
  return {
    request: new Request('http://localhost/api/ads/creatives/x/assign', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    params: { id },
    locals: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.assign.mockResolvedValue(undefined);
});

describe('POST /api/ads/creatives/:id/assign', () => {
  it('requires the ANALYTICS feature', async () => {
    await POST(ctx('cr-1', { funnelId: 'funnel-a' }));
    expect(h.requireFeature).toHaveBeenCalledWith('ANALYTICS');
  });

  it('assigns the creative to the given funnel and returns ok', async () => {
    const res = await POST(ctx('cr-1', { funnelId: 'funnel-a' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(h.assign).toHaveBeenCalledWith({ creativeId: 'cr-1', funnelId: 'funnel-a' });
  });

  it('accepts a null funnelId to clear a manual assignment', async () => {
    const res = await POST(ctx('cr-1', { funnelId: null }));
    expect(res.status).toBe(200);
    expect(h.assign).toHaveBeenCalledWith({ creativeId: 'cr-1', funnelId: null });
  });

  it('returns 400 when the id param is missing', async () => {
    const res = await POST(ctx('', { funnelId: 'funnel-a' }));
    expect(res.status).toBe(400);
    expect(h.assign).not.toHaveBeenCalled();
  });

  it('returns 404 when the creative does not exist', async () => {
    h.assign.mockRejectedValue(new Error('creative not found'));
    const res = await POST(ctx('missing', { funnelId: 'funnel-a' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when the funnel does not exist', async () => {
    h.assign.mockRejectedValue(new Error('funnel not found'));
    const res = await POST(ctx('cr-1', { funnelId: 'nope' }));
    expect(res.status).toBe(400);
  });
});
