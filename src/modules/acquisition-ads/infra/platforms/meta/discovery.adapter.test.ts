import { describe, it, expect, vi } from 'vitest';

const { logger } = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ createLogger: () => logger }));

import { MetaAccountDiscoveryAdapter } from './discovery.adapter';

function fetchStub(responses: unknown[]) {
  const calls: string[] = [];
  let i = 0;
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    const body = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  });
  return { impl, calls };
}

describe('MetaAccountDiscoveryAdapter.listAccounts', () => {
  it('stores the act_ prefixed id, exactly the form MetaInsightsAdapter needs at call time', async () => {
    const { impl } = fetchStub([{ data: [{ account_id: '123456', name: 'Glow', currency: 'USD', timezone_name: 'America/Los_Angeles' }], paging: {} }]);
    const accounts = await new MetaAccountDiscoveryAdapter(impl as never).listAccounts({ accessToken: 't' });

    expect(accounts).toEqual([
      { externalAccountId: 'act_123456', name: 'Glow', currency: 'USD', timezone: 'America/Los_Angeles' },
    ]);
  });

  it('leaves name/currency/timezone null when the platform omits them', async () => {
    const { impl } = fetchStub([{ data: [{ account_id: '1' }], paging: {} }]);
    const accounts = await new MetaAccountDiscoveryAdapter(impl as never).listAccounts({ accessToken: 't' });
    expect(accounts).toEqual([{ externalAccountId: 'act_1', name: null, currency: null, timezone: null }]);
  });

  it('skips entries with no account_id instead of persisting an unusable one', async () => {
    const { impl } = fetchStub([{ data: [{ name: 'No id' }, { account_id: '2' }], paging: {} }]);
    const accounts = await new MetaAccountDiscoveryAdapter(impl as never).listAccounts({ accessToken: 't' });
    expect(accounts).toEqual([{ externalAccountId: 'act_2', name: null, currency: null, timezone: null }]);
  });

  it('follows paging.next across pages', async () => {
    const { impl, calls } = fetchStub([
      { data: [{ account_id: '1' }], paging: { next: 'https://graph.facebook.com/next' } },
      { data: [{ account_id: '2' }], paging: {} },
    ]);
    const accounts = await new MetaAccountDiscoveryAdapter(impl as never).listAccounts({ accessToken: 't' });
    expect(accounts.map((a) => a.externalAccountId)).toEqual(['act_1', 'act_2']);
    expect(calls).toHaveLength(2);
  });

  it('stops and logs at the page cap instead of looping forever', async () => {
    logger.warn.mockClear();
    const { impl } = fetchStub([{ data: [{ account_id: '1' }], paging: { next: 'https://graph.facebook.com/next' } }]);
    const accounts = await new MetaAccountDiscoveryAdapter(impl as never, 1).listAccounts({ accessToken: 't' });
    expect(accounts).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('throws on a non-ok response', async () => {
    const impl = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response);
    await expect(new MetaAccountDiscoveryAdapter(impl as never).listAccounts({ accessToken: 't' })).rejects.toThrow(/META adaccounts 401/);
  });
});
