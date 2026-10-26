import type { AdAccountDiscoveryPort, DiscoveredAdAccount } from '../../../application/ports/outbound';
import { createLogger } from '@/lib/logger';
import { googleCapability } from './capability';

type FetchLike = typeof fetch;

const API = `https://googleads.googleapis.com/${googleCapability.apiVersion}`;
// listAccessibleCustomers is not paginated; this bounds how many ids one authorization can
// produce connections for. Ad account counts are naturally tiny (single digits to low tens), so
// this cap only ever bites a malformed or hostile response.
const DEFAULT_MAX_ACCOUNTS = 200;
const logger = createLogger('GoogleAccountDiscovery');

function digitsOnly(id: string): string {
  return id.replace(/[^0-9]/g, '');
}

export class GoogleAccountDiscoveryAdapter implements AdAccountDiscoveryPort {
  readonly platform = 'GOOGLE';

  constructor(
    private readonly developerToken: string | undefined,
    // Arrow, not a bare `fetch` reference: called as `this.fetchImpl(...)` a bare reference
    // rebinds `this` and Workers throws "Illegal invocation".
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly maxAccounts: number = DEFAULT_MAX_ACCOUNTS,
  ) {}

  async listAccounts(input: { accessToken: string; loginCustomerId?: string }): Promise<DiscoveredAdAccount[]> {
    if (!this.developerToken) {
      throw new Error('GOOGLE account discovery requires a developer token');
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${input.accessToken}`,
      'developer-token': this.developerToken,
      'content-type': 'application/json',
    };
    if (input.loginCustomerId) headers['login-customer-id'] = digitsOnly(input.loginCustomerId);

    const res = await this.fetchImpl(`${API}/customers:listAccessibleCustomers`, { headers });
    if (!res.ok) throw new Error(`GOOGLE listAccessibleCustomers ${res.status}`);
    const json = (await res.json()) as { resourceNames?: string[] };
    const ids = (json.resourceNames ?? [])
      .map((name) => name.split('/')[1])
      .filter((id): id is string => Boolean(id));

    const truncated = ids.length > this.maxAccounts;
    const boundedIds = truncated ? ids.slice(0, this.maxAccounts) : ids;
    if (truncated) {
      logger.warn('GOOGLE listAccessibleCustomers returned more accounts than the discovery cap; extra accounts were dropped', {
        total: ids.length,
        cap: this.maxAccounts,
      });
    }

    // Deliberately no per-customer detail lookup here (a prior version issued one searchStream
    // call per id). That was N sequential HTTP round-trips inside a synchronous OAuth callback --
    // a real timeout risk for an MCC-linked account tree -- and it was redundant: the first
    // insights sync already resolves reportingTimezone via fetchAccountTimezone whenever it is
    // still null, and every insight row already carries customer.currencyCode. Do not re-add
    // enrichment here; let the sync path fill these in lazily instead.
    return boundedIds.map((id) => ({
      externalAccountId: digitsOnly(id),
      name: null,
      currency: null,
      timezone: null,
    }));
  }
}
