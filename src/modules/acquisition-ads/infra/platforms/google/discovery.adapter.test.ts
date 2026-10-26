import { describe, it, expect, vi } from 'vitest';

const { logger } = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ createLogger: () => logger }));

import { GoogleAccountDiscoveryAdapter } from './discovery.adapter';

describe('GoogleAccountDiscoveryAdapter.listAccounts', () => {
  it('throws without a developer token instead of issuing a request that always 401s', async () => {
    const impl = vi.fn();
    await expect(
      new GoogleAccountDiscoveryAdapter(undefined, impl as never).listAccounts({ accessToken: 't' }),
    ).rejects.toThrow(/developer token/i);
    expect(impl).not.toHaveBeenCalled();
  });

  it('lists customer ids with name/currency/timezone left null, issuing exactly one request', async () => {
    const impl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ resourceNames: ['customers/1234567890', 'customers/1112223333'] }),
    }) as unknown as Response);

    const accounts = await new GoogleAccountDiscoveryAdapter('dev', impl as never).listAccounts({ accessToken: 't' });

    // No per-customer enrichment call: only the listAccessibleCustomers request.
    expect(impl).toHaveBeenCalledTimes(1);
    expect(accounts).toEqual([
      { externalAccountId: '1234567890', name: null, currency: null, timezone: null },
      { externalAccountId: '1112223333', name: null, currency: null, timezone: null },
    ]);
  });

  it('strips dashes from a dashed customer id', async () => {
    const impl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ resourceNames: ['customers/123-456-7890'] }),
    }) as unknown as Response);

    const accounts = await new GoogleAccountDiscoveryAdapter('dev', impl as never).listAccounts({ accessToken: 't' });
    expect(accounts).toEqual([{ externalAccountId: '1234567890', name: null, currency: null, timezone: null }]);
  });

  it('caps the number of accounts returned and logs the truncation instead of failing silently', async () => {
    logger.warn.mockClear();
    const resourceNames = Array.from({ length: 3 }, (_, i) => `customers/${i + 1}`);
    const impl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ resourceNames }),
    }) as unknown as Response);

    const accounts = await new GoogleAccountDiscoveryAdapter('dev', impl as never, 2).listAccounts({ accessToken: 't' });
    expect(accounts).toHaveLength(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), { total: 3, cap: 2 });
  });

  it('throws on a non-ok listAccessibleCustomers response', async () => {
    const impl = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }) as unknown as Response);
    await expect(new GoogleAccountDiscoveryAdapter('dev', impl as never).listAccounts({ accessToken: 't' })).rejects.toThrow(
      /GOOGLE listAccessibleCustomers 403/,
    );
  });

  it('sends the developer token and login-customer-id headers', async () => {
    const impl = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, json: async () => ({ resourceNames: [] }) }) as unknown as Response);
    await new GoogleAccountDiscoveryAdapter('dev', impl as never).listAccounts({ accessToken: 'tok', loginCustomerId: '123-456-7890' });

    const [, init] = impl.mock.calls[0];
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer tok',
      'developer-token': 'dev',
      'login-customer-id': '1234567890',
    });
  });
});
