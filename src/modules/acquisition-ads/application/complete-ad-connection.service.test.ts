import { describe, it, expect, vi } from 'vitest';
import { CompleteAdConnectionService } from './complete-ad-connection.service';
import { NoAdAccountsDiscoveredError } from '../domain/errors';
import { SealedToken } from '../domain/value-objects/sealed-token';
import type { AdAccountConnection } from '../domain/connection/ad-account-connection';
import type { DiscoveredAdAccount } from './ports/outbound';
import { metaCapability } from '../infra/platforms/meta/capability';

function setup(accounts: DiscoveredAdAccount[], opts: { failSaveFor?: Set<string> } = {}) {
  const saved = new Map<string, AdAccountConnection>();
  const savedMeta: Array<{ externalAccountId: string; currency: string | null; timezone: string | null }> = [];
  const published: Array<{ type: string; payload: unknown }> = [];
  const logger = { warn: vi.fn() };
  let n = 0;

  const svc = new CompleteAdConnectionService({
    oauthFor: () => ({
      capability: () => metaCapability,
      buildAuthorizeUrl: () => 'unused',
      exchangeCode: async () => {
        throw new Error('completeFromGrant must not call exchangeCode');
      },
      refresh: async () => {
        throw new Error('not used in this test');
      },
    }),
    discoveryFor: () => ({
      discover: async () => [{ id: 'd1', kind: 'PIXEL', externalId: 'px-1', isDefault: true }],
    }),
    accountDiscoveryFor: () => ({
      platform: 'META',
      listAccounts: async () => accounts,
    }),
    tokenCipher: {
      seal: async (plaintext: string, tokenVersion: number) =>
        SealedToken.of({ ciphertext: `c:${plaintext}`, iv: 'iv', tokenVersion }),
      open: async () => '',
    },
    connectionRepo: {
      findById: async (id) => saved.get(id) ?? null,
      findByPlatformAccount: async (_platform, externalAccountId) =>
        [...saved.values()].find((c) => c.externalAccountId === externalAccountId) ?? null,
      list: async () => [...saved.values()],
      save: async (c) => {
        if (opts.failSaveFor?.has(c.externalAccountId)) {
          throw new Error(`save exploded for ${c.externalAccountId}`);
        }
        saved.set(c.id, c);
      },
      saveDiscoveredMeta: async (input) => {
        savedMeta.push({ externalAccountId: input.externalAccountId, currency: input.currency, timezone: input.timezone });
      },
    },
    events: { publish: async (e) => { published.push(e); } },
    decodeState: async () => {
      throw new Error('not used in this test');
    },
    newId: () => `id-${n++}`,
    logger,
  });

  return { svc, saved, savedMeta, published, logger };
}

const grant = {
  accessToken: 'relay-access-token',
  refreshToken: 'relay-refresh-token',
  expiresInSec: 5_184_000,
  grantedScopes: metaCapability.requiredConversionScopes,
};

describe('CompleteAdConnectionService.completeFromGrant', () => {
  it('creates one connection per discovered account, sharing the same token', async () => {
    const { svc, saved, published } = setup([
      { externalAccountId: 'act_1', name: 'Acct 1', currency: 'USD', timezone: 'America/New_York' },
      { externalAccountId: 'act_2', name: 'Acct 2', currency: null, timezone: null },
      { externalAccountId: 'act_3', name: 'Acct 3', currency: 'EUR', timezone: null },
    ]);

    const result = await svc.completeFromGrant({ platform: 'META', grant });

    expect(result.connectionIds).toHaveLength(3);
    expect(saved.size).toBe(3);
    for (const conn of saved.values()) {
      expect(conn.platform).toBe('META');
      expect(conn.accessToken.ciphertext).toBe('c:relay-access-token');
      expect(conn.isCapiCapable()).toBe(true);
      expect(conn.destinations).toHaveLength(1);
    }
    expect([...saved.values()].map((c) => c.externalAccountId).sort()).toEqual(['act_1', 'act_2', 'act_3']);
    expect(published).toHaveLength(1);
    expect(published[0].type).toBe('AdAccountConnected');
  });

  it('persists reporting currency/timezone only when discovery returned them', async () => {
    const { savedMeta } = await (async () => {
      const s = setup([
        { externalAccountId: 'act_1', name: null, currency: 'USD', timezone: 'America/New_York' },
        { externalAccountId: 'act_2', name: null, currency: null, timezone: null },
      ]);
      await s.svc.completeFromGrant({ platform: 'META', grant });
      return s;
    })();

    expect(savedMeta).toEqual([{ externalAccountId: 'act_1', currency: 'USD', timezone: 'America/New_York' }]);
  });

  it('never persists a connection and fails with a stable error when discovery finds zero accounts', async () => {
    const { svc, saved, published } = setup([]);

    await expect(svc.completeFromGrant({ platform: 'META', grant })).rejects.toThrow(NoAdAccountsDiscoveredError);
    expect(saved.size).toBe(0);
    expect(published).toHaveLength(0);
  });

  it('re-authorizing an already-connected account updates the existing row instead of colliding', async () => {
    const { svc, saved } = setup([{ externalAccountId: 'act_1', name: null, currency: null, timezone: null }]);

    await svc.completeFromGrant({ platform: 'META', grant });
    const firstId = [...saved.keys()][0];
    expect(saved.size).toBe(1);

    await svc.completeFromGrant({
      platform: 'META',
      grant: { ...grant, accessToken: 're-authorized-token' },
    });

    expect(saved.size).toBe(1);
    const conn = saved.get(firstId);
    expect(conn).toBeDefined();
    expect(conn!.accessToken.ciphertext).toBe('c:re-authorized-token');
  });

  it('when the second of three accounts fails to persist, still persists the first and third and reports only those', async () => {
    const { svc, saved, published, logger } = setup(
      [
        { externalAccountId: 'act_1', name: null, currency: null, timezone: null },
        { externalAccountId: 'act_2', name: null, currency: null, timezone: null },
        { externalAccountId: 'act_3', name: null, currency: null, timezone: null },
      ],
      { failSaveFor: new Set(['act_2']) },
    );

    const result = await svc.completeFromGrant({ platform: 'META', grant });

    expect(saved.size).toBe(2);
    expect([...saved.values()].map((c) => c.externalAccountId).sort()).toEqual(['act_1', 'act_3']);
    // The result only reports the ids that actually landed, not one for the account that failed.
    expect(result.connectionIds).toHaveLength(2);
    expect(result.connectionIds.every((id) => [...saved.keys()].includes(id))).toBe(true);
    expect(published).toHaveLength(1);
    expect(published[0].payload).toMatchObject({ connectionIds: result.connectionIds });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      platform: 'META',
      externalAccountId: 'act_2',
    }));
  });

  it('fails with the no-accounts error and persists nothing when every discovered account fails', async () => {
    const { svc, saved, published, logger } = setup(
      [
        { externalAccountId: 'act_1', name: null, currency: null, timezone: null },
        { externalAccountId: 'act_2', name: null, currency: null, timezone: null },
      ],
      { failSaveFor: new Set(['act_1', 'act_2']) },
    );

    await expect(svc.completeFromGrant({ platform: 'META', grant })).rejects.toThrow(NoAdAccountsDiscoveredError);
    expect(saved.size).toBe(0);
    expect(published).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});
