import type { AdAccountDiscoveryPort, DiscoveredAdAccount } from '../../../application/ports/outbound';
import { createLogger } from '@/lib/logger';
import { metaCapability } from './capability';

type FetchLike = typeof fetch;

const GRAPH = `https://graph.facebook.com/${metaCapability.apiVersion}`;
const DEFAULT_MAX_PAGES = 20;
const logger = createLogger('MetaAccountDiscovery');

export class MetaAccountDiscoveryAdapter implements AdAccountDiscoveryPort {
  readonly platform = 'META';

  constructor(
    // Arrow, not a bare `fetch` reference: called as `this.fetchImpl(...)` a bare reference
    // rebinds `this` and Workers throws "Illegal invocation".
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly maxPages: number = DEFAULT_MAX_PAGES,
  ) {}

  async listAccounts(input: { accessToken: string }): Promise<DiscoveredAdAccount[]> {
    const q = new URLSearchParams({
      fields: 'account_id,name,currency,timezone_name',
      limit: '200',
      access_token: input.accessToken,
    });
    let url: string | null = `${GRAPH}/me/adaccounts?${q.toString()}`;
    const accounts: DiscoveredAdAccount[] = [];
    let pages = 0;

    while (url) {
      const res = await this.fetchImpl(url);
      if (!res.ok) throw new Error(`META adaccounts ${res.status}`);
      const json = (await res.json()) as { data?: any[]; paging?: { next?: string } };
      for (const d of json.data ?? []) {
        if (!d.account_id) continue;
        // /me/adaccounts returns bare digits, but MetaInsightsAdapter builds every downstream
        // call as GRAPH/{externalAccountId}/insights, which requires the "act_" prefixed form.
        // Storing anything else here produces a connection that authorizes fine and 404s on
        // every sync, so this is the one place that form is decided -- pinned by a test.
        accounts.push({
          externalAccountId: `act_${d.account_id}`,
          name: d.name ? String(d.name) : null,
          currency: d.currency ? String(d.currency) : null,
          timezone: d.timezone_name ? String(d.timezone_name) : null,
        });
      }
      pages += 1;
      const next = json.paging?.next ?? null;
      if (next && pages >= this.maxPages) {
        logger.warn('META adaccounts listing hit the page cap; some accounts were not discovered', { pages });
        break;
      }
      url = next;
    }

    return accounts;
  }
}
