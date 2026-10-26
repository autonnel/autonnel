import { describe, it, expect, vi } from 'vitest';

const { logger } = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ createLogger: () => logger }));

import { TikTokAccountDiscoveryAdapter } from './discovery.adapter';

const app = { clientId: 'app-id', clientSecret: 'app-secret' };

describe('TikTokAccountDiscoveryAdapter.listAccounts', () => {
  it('throws without app credentials, since the relay never hands them to us', async () => {
    const impl = vi.fn();
    await expect(new TikTokAccountDiscoveryAdapter(undefined, impl as never).listAccounts({ accessToken: 't' })).rejects.toThrow(
      /app id and secret/i,
    );
    expect(impl).not.toHaveBeenCalled();
  });

  it('maps advertiser_id/advertiser_name and leaves currency/timezone null', async () => {
    const impl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: { list: [{ advertiser_id: '111', advertiser_name: 'Glow Ads' }] } }),
    }) as unknown as Response);

    const accounts = await new TikTokAccountDiscoveryAdapter(app, impl as never).listAccounts({ accessToken: 't' });
    expect(accounts).toEqual([{ externalAccountId: '111', name: 'Glow Ads', currency: null, timezone: null }]);
  });

  it('sends app_id, secret and the Access-Token header', async () => {
    const impl = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: { list: [] } }),
    }) as unknown as Response);
    await new TikTokAccountDiscoveryAdapter(app, impl as never).listAccounts({ accessToken: 'tok' });

    const [url, init] = impl.mock.calls[0];
    expect(url).toContain('app_id=app-id');
    expect(url).toContain('secret=app-secret');
    expect(init?.headers).toEqual({ 'Access-Token': 'tok' });
  });

  it('treats a 200 response with a non-zero envelope code as a failure', async () => {
    const impl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 40001, message: 'invalid access token' }),
    }) as unknown as Response);
    await expect(new TikTokAccountDiscoveryAdapter(app, impl as never).listAccounts({ accessToken: 't' })).rejects.toThrow(
      /TIKTOK advertiser\/get 40001/,
    );
  });

  it('caps the number of accounts returned and logs the truncation', async () => {
    logger.warn.mockClear();
    const list = Array.from({ length: 3 }, (_, i) => ({ advertiser_id: String(i + 1), advertiser_name: `A${i + 1}` }));
    const impl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: { list } }),
    }) as unknown as Response);

    const accounts = await new TikTokAccountDiscoveryAdapter(app, impl as never, 2).listAccounts({ accessToken: 't' });
    expect(accounts).toHaveLength(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), { total: 3, cap: 2 });
  });

  it('throws on a non-ok HTTP response', async () => {
    const impl = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response);
    await expect(new TikTokAccountDiscoveryAdapter(app, impl as never).listAccounts({ accessToken: 't' })).rejects.toThrow(
      /TIKTOK advertiser\/get 500/,
    );
  });
});
