import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_MARKETPLACE_URL = 'https://autonnel.com';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface MarketplaceClientOptions {
  base?: string;
  fetchImpl?: FetchFn;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface DeviceTokenError {
  error: string;
}

export type DeviceTokenResult =
  | { ok: true; token: AccessTokenResponse }
  | { ok: false; error: string };

export interface OrderEntitlement {
  item: string | null;
  slug: string;
  kind: 'plugin' | 'template';
  version: string;
  orderToken: string;
  purchasedAt: string;
}

export interface OrdersResponse {
  items: OrderEntitlement[];
}

export interface DownloadUrlResponse {
  url: string;
  key: string;
  version: string;
  sha256: string;
}

export interface StoredCredentials {
  accessToken: string;
  tokenType: string;
  scope: string;
  issuer: string;
  obtainedAt: string;
}

export class MarketplaceError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'MarketplaceError';
  }
}

export function resolveBaseUrl(flagBase: string | undefined): string {
  const raw = flagBase || process.env.AUTONNEL_MARKETPLACE_URL || DEFAULT_MARKETPLACE_URL;
  return raw.replace(/\/+$/, '');
}

export function credentialsDir(consumerRoot: string): string {
  return join(consumerRoot, '.autonnel');
}

export function credentialsPath(consumerRoot: string): string {
  return join(credentialsDir(consumerRoot), 'credentials.json');
}

export function readCredentials(consumerRoot: string): StoredCredentials | null {
  const path = credentialsPath(consumerRoot);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as StoredCredentials;
  } catch {
    return null;
  }
}

export function writeCredentials(consumerRoot: string, creds: StoredCredentials): void {
  const dir = credentialsDir(consumerRoot);
  mkdirSync(dir, { recursive: true });
  const path = credentialsPath(consumerRoot);
  writeFileSync(path, JSON.stringify(creds, null, 2) + '\n');
  if (process.platform !== 'win32') {
    try {
      chmodSync(path, 0o600);
    } catch {
      // chmod best-effort; the file is still inside the gitignored .autonnel dir.
    }
  }
}

export class MarketplaceClient {
  readonly base: string;
  private readonly fetchImpl: FetchFn;

  constructor(opts: MarketplaceClientOptions = {}) {
    this.base = resolveBaseUrl(opts.base);
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async deviceCode(): Promise<DeviceCodeResponse> {
    const res = await this.fetchImpl(`${this.base}/api/cli/device-code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    if (!res.ok) {
      throw new MarketplaceError(`device-code failed (${res.status})`, res.status);
    }
    return (await res.json()) as DeviceCodeResponse;
  }

  async pollDeviceToken(deviceCode: string): Promise<DeviceTokenResult> {
    const res = await this.fetchImpl(`${this.base}/api/cli/device-token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_code: deviceCode }),
    });
    const data = (await res.json().catch(() => null)) as
      | AccessTokenResponse
      | DeviceTokenError
      | null;
    if (res.ok && data && 'access_token' in data) {
      return { ok: true, token: data };
    }
    const error = data && 'error' in data ? data.error : `http_${res.status}`;
    return { ok: false, error };
  }

  async listOrders(accessToken: string): Promise<OrdersResponse> {
    const res = await this.fetchImpl(`${this.base}/api/cli/orders`, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) throw new MarketplaceError('unauthorized', 401);
    if (!res.ok) throw new MarketplaceError(`orders failed (${res.status})`, res.status);
    return (await res.json()) as OrdersResponse;
  }

  async requestDownloadUrl(
    accessToken: string,
    body: { item: string; version?: string },
  ): Promise<DownloadUrlResponse> {
    const res = await this.fetchImpl(`${this.base}/api/cli/download-url`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new MarketplaceError(data?.error ?? `download-url failed (${res.status})`, res.status);
    }
    return (await res.json()) as DownloadUrlResponse;
  }
}
