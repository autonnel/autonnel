import type { AdInsightRow, AdInsightsFetchInput, AdInsightsPort } from '../../../application/ports/outbound';
import { createLogger } from '@/lib/logger';
import { googleCapability } from './capability';

type FetchLike = typeof fetch;

const ENDPOINT = (customerId: string) =>
  `https://googleads.googleapis.com/${googleCapability.apiVersion}/customers/${customerId}/googleAds:searchStream`;
const DEFAULT_MAX_PAGES = 20;
const logger = createLogger('GoogleInsights');
const WARN_MESSAGE = 'Google insight field did not parse to a number, defaulting to 0';

// The narrow set of credentials the searchStream call actually needs. Keeping this separate
// from AdInsightsFetchInput means fetchAccountTimezone (which has no start/end) does not have
// to fabricate empty date strings and cast to call the shared helper.
interface GoogleSearchCredentials {
  accessToken: string;
  externalAccountId: string;
  developerToken: string;
  loginCustomerId?: string;
}

function digitsOnly(customerId: string): string {
  return customerId.replace(/-/g, '');
}

// null/undefined mean the field is legitimately absent (falls back to 0 without comment). A
// present but non-numeric value is a malformed upstream field: log it and default to 0 rather
// than throw, so one bad field does not lose the whole account's sync.
function toInt(value: unknown, field: string): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn(WARN_MESSAGE, { field, value });
    return 0;
  }
  return Math.trunc(n);
}

function toFloat(value: unknown, field: string): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn(WARN_MESSAGE, { field, value });
    return 0;
  }
  return n;
}

// Google Ads reports cost in micros (millionths of the currency unit); minor units are
// hundredths. micros / 10_000 = micros / 1_000_000 * 100. Dividing by 100 here instead of
// 10_000 would silently report every campaign as 100x more expensive than it really is.
function microsToMinor(value: unknown, field: string): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn(WARN_MESSAGE, { field, value });
    return 0;
  }
  return Math.round(n / 10_000);
}

// customer.currency_code is an account-level property Google duplicates onto every result row; a
// missing value is a malformed upstream response, not a legitimately currency-less account. Never
// default it to USD: the reconciliation UI groups by currency and must not sum across currencies
// (same rule TikTok's adapter enforces for the accounts whose report rows carry no currency at all).
function requireCurrency(value: unknown, customerId: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error(`GOOGLE insights for customer ${customerId} has no currency_code; refusing to guess`);
}

// metrics.conversions_value is a plain currency amount (not micros); minor units are hundredths.
function currencyToMinorOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn(WARN_MESSAGE, { field, value });
    return null;
  }
  return Math.round(n * 100);
}

export class GoogleAdsInsightsAdapter implements AdInsightsPort {
  readonly platform = 'GOOGLE';

  constructor(
    // Arrow, not a bare `fetch` reference: called as `this.fetchImpl(...)` a bare reference
    // rebinds `this` and Workers throws "Illegal invocation".
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly maxPages: number = DEFAULT_MAX_PAGES,
  ) {}

  async fetchAdInsights(input: AdInsightsFetchInput): Promise<{ rows: AdInsightRow[]; truncated: boolean }> {
    if (!input.developerToken) throw new Error('GOOGLE insights requires a developer token');

    // final_urls rides along with the metrics in the same GAQL query, so there is no second hop
    // like Meta's separate /ads join for destination urls.
    const query = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.final_urls,
        ad_group_ad.status,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        customer.currency_code,
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group_ad
      WHERE segments.date BETWEEN '${input.start}' AND '${input.end}'
    `;

    const { chunks, truncated } = await this.search(
      {
        accessToken: input.accessToken,
        externalAccountId: input.externalAccountId,
        developerToken: input.developerToken,
        loginCustomerId: input.loginCustomerId,
      },
      query,
    );

    const rows: AdInsightRow[] = [];
    for (const chunk of chunks) {
      for (const r of chunk.results ?? []) {
        const ad = r.adGroupAd?.ad ?? {};
        const finalUrls: string[] = Array.isArray(ad.finalUrls) ? ad.finalUrls : [];
        rows.push({
          externalAdId: String(ad.id),
          name: String(ad.name ?? ad.id ?? ''),
          status: String(r.adGroupAd?.status ?? 'UNKNOWN'),
          campaignExternalId: r.campaign?.id ? String(r.campaign.id) : null,
          campaignName: r.campaign?.name ? String(r.campaign.name) : null,
          adsetExternalId: r.adGroup?.id ? String(r.adGroup.id) : null,
          adsetName: r.adGroup?.name ? String(r.adGroup.name) : null,
          destinationUrl: finalUrls[0] ?? null,
          date: String(r.segments?.date),
          currency: requireCurrency(r.customer?.currencyCode, input.externalAccountId),
          spendMinor: microsToMinor(r.metrics?.costMicros, 'costMicros'),
          impressions: toInt(r.metrics?.impressions, 'impressions'),
          clicks: toInt(r.metrics?.clicks, 'clicks'),
          // Google Ads has no separate link-click metric; null renders as "-", never as 0.
          linkClicks: null,
          conversions: toFloat(r.metrics?.conversions, 'conversions'),
          // Google Ads has no checkout-start metric in this report; null keeps it rendered as "-"
          // rather than claiming zero checkouts.
          initiateCheckout: null,
          conversionValueMinor: currencyToMinorOrNull(r.metrics?.conversionsValue, 'conversionsValue'),
        });
      }
    }

    return { rows, truncated };
  }

  async fetchAccountTimezone(input: {
    accessToken: string;
    externalAccountId: string;
    developerToken?: string;
  }): Promise<string | null> {
    if (!input.developerToken) return null;
    const { chunks } = await this.search(
      {
        accessToken: input.accessToken,
        externalAccountId: input.externalAccountId,
        developerToken: input.developerToken,
      },
      'SELECT customer.time_zone FROM customer LIMIT 1',
    );
    for (const chunk of chunks) {
      const tz = chunk.results?.[0]?.customer?.timeZone;
      if (tz) return String(tz);
    }
    return null;
  }

  private async search(
    creds: GoogleSearchCredentials,
    query: string,
  ): Promise<{ chunks: any[]; truncated: boolean }> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${creds.accessToken}`,
      'developer-token': creds.developerToken,
      'content-type': 'application/json',
    };
    if (creds.loginCustomerId) headers['login-customer-id'] = digitsOnly(creds.loginCustomerId);

    const res = await this.fetchImpl(ENDPOINT(digitsOnly(creds.externalAccountId)), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`GOOGLE insights ${res.status}`);
    const json = await res.json();
    // searchStream returns an array of chunks; a plain object comes back from the non-stream
    // shape (e.g. in tests). Bound the number of chunks consumed so a runaway stream cannot
    // grow memory unbounded; report it through the port's truncated flag, never silently.
    const allChunks: any[] = Array.isArray(json) ? json : [json];
    const truncated = allChunks.length > this.maxPages;
    const chunks = truncated ? allChunks.slice(0, this.maxPages) : allChunks;
    return { chunks, truncated };
  }
}
