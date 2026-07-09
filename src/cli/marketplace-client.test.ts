import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MarketplaceClient,
  MarketplaceError,
  resolveBaseUrl,
  readCredentials,
  writeCredentials,
  credentialsPath,
  type FetchFn,
} from './marketplace-client.js';
import { runAuthorizeWith } from './authorize.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// A scripted fetch that returns each queued response in order, recording the request bodies.
function scriptedFetch(responses: Response[]): { fetchImpl: FetchFn; calls: { url: string; body?: unknown }[] } {
  const calls: { url: string; body?: unknown }[] = [];
  let i = 0;
  const fetchImpl: FetchFn = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, body });
    const res = responses[Math.min(i, responses.length - 1)];
    i++;
    return res;
  };
  return { fetchImpl, calls };
}

describe('resolveBaseUrl', () => {
  const ORIG = process.env.AUTONNEL_MARKETPLACE_URL;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.AUTONNEL_MARKETPLACE_URL;
    else process.env.AUTONNEL_MARKETPLACE_URL = ORIG;
  });

  it('prefers the flag, then env, then the default', () => {
    delete process.env.AUTONNEL_MARKETPLACE_URL;
    expect(resolveBaseUrl(undefined)).toBe('https://autonnel.com');
    expect(resolveBaseUrl('http://localhost:4559/')).toBe('http://localhost:4559');
    process.env.AUTONNEL_MARKETPLACE_URL = 'http://env-host:9000';
    expect(resolveBaseUrl(undefined)).toBe('http://env-host:9000');
    expect(resolveBaseUrl('http://flag-wins')).toBe('http://flag-wins');
  });
});

describe('credentials store', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'autonnel-creds-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('round-trips credentials and (on posix) chmods 600', () => {
    expect(readCredentials(tmp)).toBeNull();
    writeCredentials(tmp, {
      accessToken: 'tok',
      tokenType: 'Bearer',
      scope: 'marketplace:read',
      issuer: 'http://localhost:4559',
      obtainedAt: new Date().toISOString(),
    });
    const path = credentialsPath(tmp);
    expect(existsSync(path)).toBe(true);
    expect(readCredentials(tmp)?.accessToken).toBe('tok');
    if (process.platform !== 'win32') {
      expect(statSync(path).mode & 0o777).toBe(0o600);
    }
  });

  it('returns null for corrupt credentials json', () => {
    writeCredentials(tmp, {
      accessToken: 't',
      tokenType: 'Bearer',
      scope: '',
      issuer: '',
      obtainedAt: '',
    });
    // Corrupt the file in place.
    const fs = require('node:fs') as typeof import('node:fs');
    fs.writeFileSync(credentialsPath(tmp), '{not json');
    expect(readCredentials(tmp)).toBeNull();
  });
});

describe('MarketplaceClient endpoints (injected fetch)', () => {
  it('deviceCode parses the RFC 8628 start response', async () => {
    const { fetchImpl } = scriptedFetch([
      jsonResponse({
        device_code: 'dev123',
        user_code: 'ABCD-1234',
        verification_uri: 'http://h/activate',
        verification_uri_complete: 'http://h/activate?code=ABCD-1234',
        expires_in: 600,
        interval: 5,
      }),
    ]);
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl });
    const start = await client.deviceCode();
    expect(start.device_code).toBe('dev123');
    expect(start.user_code).toBe('ABCD-1234');
    expect(start.interval).toBe(5);
  });

  it('listOrders throws MarketplaceError(401) on unauthorized', async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ error: 'unauthorized' }, 401)]);
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl });
    await expect(client.listOrders('bad')).rejects.toMatchObject({ status: 401 });
  });

  it('requestDownloadUrl surfaces the server error string', async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ error: 'forbidden' }, 403)]);
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl });
    await expect(
      client.requestDownloadUrl('tok', { item: '@autonnel/plugin-ads' }),
    ).rejects.toBeInstanceOf(MarketplaceError);
  });

  it('pollDeviceToken returns ok on access_token and not-ok with error otherwise', async () => {
    const { fetchImpl } = scriptedFetch([
      jsonResponse({ error: 'authorization_pending' }, 400),
      jsonResponse({ access_token: 'AT', token_type: 'Bearer', scope: 'marketplace:read' }, 200),
    ]);
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl });
    const pending = await client.pollDeviceToken('dev');
    expect(pending).toEqual({ ok: false, error: 'authorization_pending' });
    const approved = await client.pollDeviceToken('dev');
    expect(approved.ok).toBe(true);
    if (approved.ok) expect(approved.token.access_token).toBe('AT');
  });
});

describe('runAuthorizeWith device-flow state machine', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'autonnel-auth-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('pending -> slow_down (interval grows) -> approved -> persists access_token', async () => {
    const responses = [
      // device-code
      jsonResponse({
        device_code: 'dev123',
        user_code: 'ABCD-1234',
        verification_uri: 'http://h/activate',
        verification_uri_complete: 'http://h/activate?code=ABCD-1234',
        expires_in: 600,
        interval: 5,
      }),
      // poll #1: pending
      jsonResponse({ error: 'authorization_pending' }, 400),
      // poll #2: slow_down
      jsonResponse({ error: 'slow_down' }, 400),
      // poll #3: approved
      jsonResponse({ access_token: 'AT-final', token_type: 'Bearer', scope: 'marketplace:read marketplace:download' }, 200),
      // resolveEmail probe -> /api/cli/orders
      jsonResponse({ items: [] }, 200),
    ];
    const { fetchImpl, calls } = scriptedFetch(responses);
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl });

    const slept: number[] = [];
    const logs: string[] = [];
    const ok = await runAuthorizeWith([], {
      consumerRoot: tmp,
      client,
      log: (m) => logs.push(m),
      sleepFn: async (ms) => {
        slept.push(ms);
      },
      openFn: async () => {},
      now: () => 1_000,
    });

    expect(ok).toBe(true);
    // interval started at 5s; slow_down bumped it to 10s for the third poll.
    expect(slept).toEqual([5000, 5000, 10000]);
    const creds = readCredentials(tmp);
    expect(creds?.accessToken).toBe('AT-final');
    expect(creds?.issuer).toBe('http://h');
    expect(logs.join('\n')).toContain('Authorized');
    // device-code + 3 polls + 1 orders probe.
    expect(calls.length).toBe(5);
    expect(calls[0].url).toBe('http://h/api/cli/device-code');
    expect(calls[3].body).toEqual({ device_code: 'dev123' });
  });

  it('aborts on expired_token without persisting credentials', async () => {
    const responses = [
      jsonResponse({
        device_code: 'dev123',
        user_code: 'ABCD-1234',
        verification_uri: 'http://h/activate',
        verification_uri_complete: 'http://h/activate?code=ABCD-1234',
        expires_in: 600,
        interval: 5,
      }),
      jsonResponse({ error: 'expired_token' }, 400),
    ];
    const { fetchImpl } = scriptedFetch(responses);
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl });
    const logs: string[] = [];
    const ok = await runAuthorizeWith([], {
      consumerRoot: tmp,
      client,
      log: (m) => logs.push(m),
      sleepFn: async () => {},
      openFn: async () => {},
      now: () => 1_000,
    });
    expect(ok).toBe(false);
    expect(readCredentials(tmp)).toBeNull();
    expect(logs.join('\n')).toContain('expired');
  });

  it('aborts on access_denied', async () => {
    const responses = [
      jsonResponse({
        device_code: 'dev123',
        user_code: 'ABCD-1234',
        verification_uri: 'http://h/activate',
        verification_uri_complete: 'http://h/activate?code=ABCD-1234',
        expires_in: 600,
        interval: 5,
      }),
      jsonResponse({ error: 'access_denied' }, 400),
    ];
    const { fetchImpl } = scriptedFetch(responses);
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl });
    const ok = await runAuthorizeWith([], {
      consumerRoot: tmp,
      client,
      log: () => {},
      sleepFn: async () => {},
      openFn: async () => {},
      now: () => 1_000,
    });
    expect(ok).toBe(false);
    expect(readCredentials(tmp)).toBeNull();
  });
});
