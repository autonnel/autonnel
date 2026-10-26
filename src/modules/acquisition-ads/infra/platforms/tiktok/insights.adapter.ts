import type { AdInsightRow, AdInsightsFetchInput, AdInsightsPort } from '../../../application/ports/outbound';
import { createLogger } from '@/lib/logger';
import { tiktokCapability } from './capability';

type FetchLike = typeof fetch;

const BASE = `https://business-api.tiktok.com/open_api/${tiktokCapability.apiVersion}`;
const DEFAULT_MAX_PAGES = 20;
const PAGE_SIZE = 200;
// TikTok's /ad/get/ filtering.ad_ids accepts at most 100 ids per request; requesting more would
// silently drop the extra ads' landing_page_url (they'd keep spend but become unattributed).
const AD_META_BATCH_SIZE = 100;
const logger = createLogger('TikTokInsights');
const WARN_MESSAGE = 'TikTok insight field did not parse to a number, defaulting to 0';

interface AdMeta {
  landingPageUrl: string | null;
  status: string;
}

// null/undefined mean the field is legitimately absent (falls back to 0/null without comment). A
// present but non-numeric value is a malformed upstream field: log it and default rather than
// throw, so one bad field does not lose the whole account's sync.
function toMinor(value: unknown, field: string): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn(WARN_MESSAGE, { field, value });
    return 0;
  }
  return Math.round(n * 100);
}

function toInt(value: unknown, field: string): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn(WARN_MESSAGE, { field, value });
    return 0;
  }
  return Math.trunc(n);
}

// TikTok reports modeled conversions as a fraction; unlike impressions/clicks this must not be
// truncated to an integer.
function toFloat(value: unknown, field: string): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn(WARN_MESSAGE, { field, value });
    return 0;
  }
  return n;
}

function toMinorOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn(WARN_MESSAGE, { field, value });
    return null;
  }
  return Math.round(n * 100);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// TikTok's page_info.total_page should be stable across pages of one query; taking the max seen
// guards against a later page's own page_info understating how many pages actually remain.
function maxTotalPage(previous: number, pageInfo: unknown): number {
  const info = (pageInfo ?? {}) as { total_page?: unknown };
  const n = Number(info.total_page);
  const reported = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;
  return Math.max(previous, reported);
}

export class TikTokInsightsAdapter implements AdInsightsPort {
  readonly platform = 'TIKTOK';

  constructor(
    // Arrow, not a bare `fetch` reference: called as `this.fetchImpl(...)` a bare reference
    // rebinds `this` and Workers throws "Illegal invocation".
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    // TikTok's report rows carry no currency; it is an advertiser-level property. Callers that
    // already know it (e.g. composition, reading AdAccountConnection.reportingCurrency) should
    // pass it; null defers resolution to fetchAdInsights, which calls fetchAdvertiserInfo itself.
    // Never a hardcoded default: silently stamping every row 'USD' is worse than a failed sync,
    // because the reconciliation UI groups by currency and would merge it into the wrong total.
    private currency: string | null,
    private readonly maxPages: number = DEFAULT_MAX_PAGES,
  ) {}

  // Lets a caller constructed with currency=null persist what fetchAdInsights resolved, the same
  // save-on-first-sync pattern already used for the account's reporting timezone.
  get resolvedCurrency(): string | null {
    return this.currency;
  }

  async fetchAdInsights(input: AdInsightsFetchInput): Promise<{ rows: AdInsightRow[]; truncated: boolean }> {
    let currency = this.currency;
    if (currency === null) {
      const info = await this.fetchAdvertiserInfo(input);
      if (!info.currency) {
        throw new Error(
          `TikTok advertiser ${input.externalAccountId} has no currency in its advertiser info; refusing to guess`,
        );
      }
      currency = info.currency;
      this.currency = currency;
    }
    const { rows, truncated: reportTruncated } = await this.fetchReport(input, currency);
    const adIds = [...new Set(rows.map((r) => r.externalAdId))];
    // A capped ad-meta join must feed into the same flag: dropping landing_page_url off rows
    // past the cap silently strips their funnel attribution while spend is still counted.
    const { meta, truncated: metaTruncated } = await this.fetchAdMeta(input, adIds);
    return {
      rows: rows.map((r) => ({
        ...r,
        destinationUrl: meta.get(r.externalAdId)?.landingPageUrl ?? null,
        status: meta.get(r.externalAdId)?.status ?? r.status,
      })),
      truncated: reportTruncated || metaTruncated,
    };
  }

  async fetchAccountTimezone(input: { accessToken: string; externalAccountId: string }): Promise<string | null> {
    const { timezone } = await this.fetchAdvertiserInfo(input);
    return timezone;
  }

  // /advertiser/info/ returns both timezone and currency in the same payload. This is the only
  // place that reads currency off TikTok: the caller must fetch it here and pass it into this
  // adapter's constructor, since fetchAdInsights has no other source for a report row's currency.
  async fetchAdvertiserInfo(input: {
    accessToken: string;
    externalAccountId: string;
  }): Promise<{ timezone: string | null; currency: string | null }> {
    const q = new URLSearchParams({ advertiser_ids: JSON.stringify([input.externalAccountId]) });
    const json = await this.get(`${BASE}/advertiser/info/?${q.toString()}`, input.accessToken, 'advertiser');
    const first = json?.data?.list?.[0];
    return {
      timezone: first?.timezone ? String(first.timezone) : null,
      currency: first?.currency ? String(first.currency) : null,
    };
  }

  private async fetchReport(
    input: AdInsightsFetchInput,
    currency: string,
  ): Promise<{ rows: Omit<AdInsightRow, 'destinationUrl'>[]; truncated: boolean }> {
    const rows: Omit<AdInsightRow, 'destinationUrl'>[] = [];
    let page = 1;
    let totalPage = 1;
    let truncated = false;

    for (;;) {
      const q = new URLSearchParams({
        advertiser_id: input.externalAccountId,
        report_type: 'BASIC',
        data_level: 'AUCTION_AD',
        dimensions: JSON.stringify(['ad_id', 'stat_time_day']),
        metrics: JSON.stringify([
          'ad_name',
          'campaign_id',
          'campaign_name',
          'adgroup_id',
          'adgroup_name',
          'spend',
          'impressions',
          'clicks',
          'conversion',
          'total_purchase_value',
        ]),
        start_date: input.start,
        end_date: input.end,
        page: String(page),
        page_size: String(PAGE_SIZE),
      });

      const json = await this.get(`${BASE}/report/integrated/get/?${q.toString()}`, input.accessToken, 'insights');
      for (const item of json?.data?.list ?? []) {
        const d = item.dimensions ?? {};
        const m = item.metrics ?? {};
        rows.push({
          externalAdId: String(d.ad_id),
          name: String(m.ad_name ?? ''),
          status: 'UNKNOWN',
          campaignExternalId: m.campaign_id ? String(m.campaign_id) : null,
          campaignName: m.campaign_name ? String(m.campaign_name) : null,
          adsetExternalId: m.adgroup_id ? String(m.adgroup_id) : null,
          adsetName: m.adgroup_name ? String(m.adgroup_name) : null,
          // stat_time_day comes back as "YYYY-MM-DD HH:mm:ss" in the advertiser's own timezone;
          // take the date part only and never shift it.
          date: String(d.stat_time_day).slice(0, 10),
          // Report rows carry no currency of their own: currency is sourced from
          // fetchAdvertiserInfo (the same /advertiser/info/ payload fetchAccountTimezone reads),
          // never a caller-side guess or default.
          currency,
          spendMinor: toMinor(m.spend, 'spend'),
          impressions: toInt(m.impressions, 'impressions'),
          clicks: toInt(m.clicks, 'clicks'),
          // TikTok has no separate link-click metric; null renders as "-", never as 0.
          linkClicks: null,
          conversions: toFloat(m.conversion, 'conversion'),
          // TikTok's integrated report has no checkout-start metric at this level; null keeps it
          // rendered as "-" rather than claiming zero checkouts.
          initiateCheckout: null,
          conversionValueMinor: toMinorOrNull(m.total_purchase_value, 'total_purchase_value'),
        });
      }

      totalPage = maxTotalPage(totalPage, json?.data?.page_info);
      if (page >= totalPage) break;
      if (page >= this.maxPages) {
        truncated = true;
        break;
      }
      page += 1;
    }

    return { rows, truncated };
  }

  private async fetchAdMeta(
    input: AdInsightsFetchInput,
    adIds: string[],
  ): Promise<{ meta: Map<string, AdMeta>; truncated: boolean }> {
    const meta = new Map<string, AdMeta>();
    if (adIds.length === 0) return { meta, truncated: false };

    let requestsUsed = 0;
    let truncated = false;

    for (const batch of chunk(adIds, AD_META_BATCH_SIZE)) {
      let page = 1;
      let totalPage = 1;

      for (;;) {
        if (requestsUsed >= this.maxPages) {
          truncated = true;
          break;
        }

        const q = new URLSearchParams({
          advertiser_id: input.externalAccountId,
          filtering: JSON.stringify({ ad_ids: batch }),
          fields: JSON.stringify(['ad_id', 'landing_page_url', 'operation_status']),
          page: String(page),
          page_size: String(PAGE_SIZE),
        });
        const json = await this.get(`${BASE}/ad/get/?${q.toString()}`, input.accessToken, 'ads');
        requestsUsed += 1;

        for (const a of json?.data?.list ?? []) {
          meta.set(String(a.ad_id), {
            landingPageUrl: a.landing_page_url ? String(a.landing_page_url) : null,
            status: String(a.operation_status ?? 'UNKNOWN'),
          });
        }

        totalPage = maxTotalPage(totalPage, json?.data?.page_info);
        if (page >= totalPage) break;
        page += 1;
      }

      // The page cap was hit mid-batch: stop issuing further batches too, and report the
      // interruption rather than silently leaving the remaining ids unattributed.
      if (truncated) break;
    }

    return { meta, truncated };
  }

  private async get(url: string, accessToken: string, label: string): Promise<any> {
    const res = await this.fetchImpl(url, { headers: { 'Access-Token': accessToken } });
    if (!res.ok) throw new Error(`TIKTOK ${label} ${res.status}`);
    const json = (await res.json()) as { code?: number; message?: string };
    // TikTok answers HTTP 200 with a non-zero envelope code on failure; trusting the HTTP status
    // alone silently produces empty reports.
    if (json?.code !== 0) throw new Error(`TIKTOK ${label} ${json?.code}: ${json?.message ?? 'unknown'}`);
    return json;
  }
}
