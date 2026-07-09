import { describe, it, expect } from 'vitest';
import { CreateTokenConnectionService } from './create-token-connection.service';
import { SealedToken } from '../domain/value-objects/sealed-token';
import type { AdAccountConnection } from '../domain/connection/ad-account-connection';

function setup() {
  const saved: AdAccountConnection[] = [];
  const published: Array<{ type: string; payload: unknown }> = [];
  let n = 0;
  const svc = new CreateTokenConnectionService({
    tokenCipher: {
      seal: async (plaintext: string, tokenVersion: number) =>
        SealedToken.of({ ciphertext: `c:${plaintext}`, iv: 'iv', tokenVersion }),
      open: async () => '',
    },
    connectionRepo: {
      findById: async () => null,
      findByPlatformAccount: async () => null,
      list: async () => saved,
      save: async (c) => { saved.push(c); },
    },
    events: { publish: async (e) => { published.push(e); } },
    newId: () => `id-${n++}`,
  });
  return { svc, saved, published };
}

describe('CreateTokenConnectionService', () => {
  it('creates a conversion-capable FACEBOOK connection from pixelId + accessToken', async () => {
    const { svc, saved, published } = setup();
    const res = await svc.create({
      platform: 'FACEBOOK',
      name: 'My FB Pixel',
      credentials: { pixelId: '123456', accessToken: 'EAA-token' },
    });
    expect(res.id).toBe('id-0');
    const conn = saved[0];
    expect(conn.platform).toBe('FACEBOOK');
    expect(conn.externalAccountId).toBe('123456');
    expect(conn.isCapiCapable()).toBe(true);
    expect(conn.destinations).toHaveLength(1);
    expect(conn.destinations[0]).toMatchObject({ kind: 'PIXEL', externalId: '123456', isDefault: true });
    expect(conn.accessToken.ciphertext).toBe('c:EAA-token');
    expect(conn.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);
    expect(published.map((e) => e.type)).toContain('AdAccountConnected');
  });

  it('maps BING_ADS uetTagId/capiToken and stays capi-capable', async () => {
    const { svc, saved } = setup();
    await svc.create({
      platform: 'BING_ADS',
      name: 'Bing',
      credentials: { uetTagId: '987', capiToken: 'bing-token' },
    });
    const conn = saved[0];
    expect(conn.platform).toBe('BING_ADS');
    expect(conn.externalAccountId).toBe('987');
    expect(conn.isCapiCapable()).toBe(true);
    expect(conn.accessToken.ciphertext).toBe('c:bing-token');
  });

  it('falls back to name when no account id field is provided', async () => {
    const { svc, saved } = setup();
    await svc.create({
      platform: 'TIKTOK',
      name: 'My TikTok',
      credentials: { accessToken: 'tt-token' },
    });
    expect(saved[0].externalAccountId).toBe('My TikTok');
  });

  it('rejects an unknown platform', async () => {
    const { svc } = setup();
    await expect(
      svc.create({ platform: 'GOOGLE_ADS', name: 'g', credentials: { accessToken: 'x' } }),
    ).rejects.toThrow(/unsupported token ad platform/);
  });

  it('rejects when the access token credential is missing', async () => {
    const { svc } = setup();
    await expect(
      svc.create({ platform: 'FACEBOOK', name: 'fb', credentials: { pixelId: '1' } }),
    ).rejects.toThrow(/missing accessToken/);
  });
});
