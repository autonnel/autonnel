import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  readEnv: vi.fn((_key: string) => undefined as string | undefined),
  syncAll: vi.fn(async () => ({ connections: 2, ok: 2, failed: 0, skipped: 0 })),
  makeAcquisitionAds: vi.fn(async () => ({ syncInsights: { syncAll: h.syncAll } })),
}));

vi.mock('@/lib/runtime/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/runtime/env')>();
  return { ...actual, readEnv: h.readEnv };
});
vi.mock('@/composition/make-acquisition-ads', () => ({ makeAcquisitionAds: h.makeAcquisitionAds }));
vi.mock('@/composition/make-ads-deps', () => ({ createAdsDepsForRequest: vi.fn(async () => ({})) }));

const { readEnv, syncAll, makeAcquisitionAds } = h;

import { POST, GET } from './ad-insights';

function ctx(url: string): any {
  return { request: new Request(url), locals: {} };
}

beforeEach(() => {
  readEnv.mockReset();
  readEnv.mockReturnValue(undefined);
  syncAll.mockClear();
  syncAll.mockResolvedValue({ connections: 2, ok: 2, failed: 0, skipped: 0 });
  makeAcquisitionAds.mockClear();
});

describe('POST /api/cron/ad-insights', () => {
  it('rejects an unauthenticated request without running the sweep', async () => {
    const res = await POST(ctx('http://localhost/api/cron/ad-insights'));
    expect(res.status).toBe(401);
    expect(makeAcquisitionAds).not.toHaveBeenCalled();
    expect(syncAll).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong key', async () => {
    readEnv.mockImplementation((k: string) => (k === 'CRON_KEY' ? 'right-key' : undefined));
    const res = await POST(ctx('http://localhost/api/cron/ad-insights?key=wrong-key'));
    expect(res.status).toBe(401);
    expect(syncAll).not.toHaveBeenCalled();
  });

  it('runs the sync sweep for an authenticated request and reports the summary', async () => {
    readEnv.mockImplementation((k: string) => (k === 'CRON_KEY' ? 'right-key' : undefined));
    const res = await POST(ctx('http://localhost/api/cron/ad-insights?key=right-key'));
    expect(res.status).toBe(200);
    expect(syncAll).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, connections: 2, synced: 2, failed: 0, skipped: 0 });
  });

  it('GET is authenticated the same way as POST', async () => {
    const res = await GET(ctx('http://localhost/api/cron/ad-insights'));
    expect(res.status).toBe(401);
    expect(syncAll).not.toHaveBeenCalled();
  });
});
