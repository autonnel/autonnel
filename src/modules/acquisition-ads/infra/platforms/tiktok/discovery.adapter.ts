import type { AdAccountDiscoveryPort, DiscoveredAdAccount } from '../../../application/ports/outbound';
import { createLogger } from '@/lib/logger';
import { tiktokCapability } from './capability';

type FetchLike = typeof fetch;

const BASE = `https://business-api.tiktok.com/open_api/${tiktokCapability.apiVersion}`;
const DEFAULT_MAX_ACCOUNTS = 200;
const logger = createLogger('TikTokAccountDiscovery');

export interface TikTokAppCredentials {
  clientId: string;
  clientSecret: string;
}

export class TikTokAccountDiscoveryAdapter implements AdAccountDiscoveryPort {
  readonly platform = 'TIKTOK';

  constructor(
    // Only available in the bring-your-own-app flow: the hosted relay holds its own app
    // credentials and never hands them to us, which is why TIKTOK relay is disabled today (see
    // RELAY_PLATFORMS in ads-apps.ts) -- this adapter is unreachable from that path by construction.
    private readonly app: TikTokAppCredentials | undefined,
    // Arrow, not a bare `fetch` reference: called as `this.fetchImpl(...)` a bare reference
    // rebinds `this` and Workers throws "Illegal invocation".
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly maxAccounts: number = DEFAULT_MAX_ACCOUNTS,
  ) {}

  async listAccounts(input: { accessToken: string }): Promise<DiscoveredAdAccount[]> {
    if (!this.app) {
      throw new Error('TIKTOK account discovery requires the app id and secret');
    }

    const q = new URLSearchParams({ app_id: this.app.clientId, secret: this.app.clientSecret });
    const res = await this.fetchImpl(`${BASE}/oauth2/advertiser/get/?${q.toString()}`, {
      headers: { 'Access-Token': input.accessToken },
    });
    if (!res.ok) throw new Error(`TIKTOK advertiser/get ${res.status}`);
    const json = (await res.json()) as { code?: number; message?: string; data?: { list?: any[] } };
    // TikTok answers HTTP 200 with a non-zero envelope code on failure; trusting the HTTP status
    // alone would silently discover zero accounts instead of surfacing the real error.
    if (json.code !== 0) throw new Error(`TIKTOK advertiser/get ${json.code}: ${json.message ?? 'unknown'}`);

    const list = json.data?.list ?? [];
    const truncated = list.length > this.maxAccounts;
    const bounded = truncated ? list.slice(0, this.maxAccounts) : list;
    if (truncated) {
      logger.warn('TIKTOK advertiser/get returned more accounts than the discovery cap; extra accounts were dropped', {
        total: list.length,
        cap: this.maxAccounts,
      });
    }

    const accounts: DiscoveredAdAccount[] = [];
    for (const a of bounded) {
      if (!a.advertiser_id) continue;
      // advertiser/get carries no currency or timezone; TikTokInsightsAdapter already resolves
      // both lazily from /advertiser/info/ on first sync and persists them, so leaving these null
      // here is the documented gap, not a missed field.
      accounts.push({
        externalAccountId: String(a.advertiser_id),
        name: a.advertiser_name ? String(a.advertiser_name) : null,
        currency: null,
        timezone: null,
      });
    }
    return accounts;
  }
}
