import type { AdInsightRow, AdInsightsFetchInput, AdInsightsPort } from '../../../application/ports/outbound';
import { createLogger } from '@/lib/logger';
import { metaCapability } from './capability';

type FetchLike = typeof fetch;

const GRAPH = `https://graph.facebook.com/${metaCapability.apiVersion}`;
const DEFAULT_MAX_PAGES = 20;
const logger = createLogger('MetaInsights');

// null/undefined mean the field is legitimately absent (falls back to 0 without comment). A
// present but non-numeric value is a malformed upstream field: log it and default to 0 rather
// than throw, so one bad field does not lose the whole account's sync.
function toMinor(value: unknown, field: string): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn('Meta insight field did not parse to a number, defaulting to 0', { field, value });
    return 0;
  }
  return Math.round(n * 100);
}

function toInt(value: unknown, field: string): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    logger.warn('Meta insight field did not parse to a number, defaulting to 0', { field, value });
    return 0;
  }
  return Math.trunc(n);
}

// account_currency is an account-level property Meta duplicates onto every insight row; a missing
// value is a malformed upstream response, not a legitimately currency-less account. Never default
// it to USD: the reconciliation UI groups by currency and must not sum across currencies (same
// rule TikTok's adapter enforces for the accounts whose report rows carry no currency at all).
function requireCurrency(value: unknown, adId: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error(`META insights row for ad ${adId} has no account_currency; refusing to guess`);
}

function actionValue(list: unknown, type: string): number | null {
  if (!Array.isArray(list)) return null;
  const hit = list.find((a: any) => a?.action_type === type);
  if (!hit) return null;
  const n = Number(hit.value);
  return Number.isFinite(n) ? n : null;
}

export class MetaInsightsAdapter implements AdInsightsPort {
  readonly platform = 'META';

  constructor(
    // Arrow, not a bare `fetch` reference: called as `this.fetchImpl(...)` a bare reference
    // rebinds `this` and Workers throws "Illegal invocation".
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly maxPages: number = DEFAULT_MAX_PAGES,
  ) {}

  async fetchAdInsights(input: AdInsightsFetchInput): Promise<{ rows: AdInsightRow[]; truncated: boolean }> {
    const { rows: insightRows, truncated: insightsTruncated } = await this.fetchInsightPages(input);
    const adIds = [...new Set(insightRows.map((r) => r.externalAdId))];
    // Destination-url pagination cap must feed into the same flag: a truncated /ads join
    // silently strips destinationUrl off rows past the cap, which is the exact
    // "unattributed spend" failure mode this adapter exists to avoid.
    const { linkByAdId, truncated: adsTruncated } = await this.fetchDestinationUrls(input, adIds);
    return {
      rows: insightRows.map((r) => ({ ...r, destinationUrl: linkByAdId.get(r.externalAdId) ?? null })),
      truncated: insightsTruncated || adsTruncated,
    };
  }

  async fetchAccountTimezone(input: { accessToken: string; externalAccountId: string }): Promise<string | null> {
    const q = new URLSearchParams({ fields: 'timezone_name', access_token: input.accessToken });
    const res = await this.fetchImpl(`${GRAPH}/${input.externalAccountId}?${q.toString()}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { timezone_name?: string };
    return json.timezone_name ?? null;
  }

  private async fetchInsightPages(
    input: AdInsightsFetchInput,
  ): Promise<{ rows: Omit<AdInsightRow, 'destinationUrl'>[]; truncated: boolean }> {
    const q = new URLSearchParams({
      level: 'ad',
      // Without time_increment the whole window collapses into a single aggregate row and the
      // per-day storage contract cannot be satisfied.
      time_increment: '1',
      time_range: JSON.stringify({ since: input.start, until: input.end }),
      fields: [
        'ad_id',
        'ad_name',
        'campaign_id',
        'campaign_name',
        'adset_id',
        'adset_name',
        'spend',
        'impressions',
        'clicks',
        'inline_link_clicks',
        'account_currency',
        'actions',
        'action_values',
      ].join(','),
      limit: '500',
      access_token: input.accessToken,
    });

    let url: string | null = `${GRAPH}/${input.externalAccountId}/insights?${q.toString()}`;
    const rows: Omit<AdInsightRow, 'destinationUrl'>[] = [];
    let pages = 0;

    while (url) {
      const res = await this.fetchImpl(url);
      if (!res.ok) throw new Error(`META insights ${res.status}`);
      const json = (await res.json()) as { data?: any[]; paging?: { next?: string } };
      for (const d of json.data ?? []) {
        rows.push({
          externalAdId: String(d.ad_id),
          name: String(d.ad_name ?? ''),
          status: 'UNKNOWN',
          campaignExternalId: d.campaign_id ? String(d.campaign_id) : null,
          campaignName: d.campaign_name ? String(d.campaign_name) : null,
          adsetExternalId: d.adset_id ? String(d.adset_id) : null,
          adsetName: d.adset_name ? String(d.adset_name) : null,
          date: String(d.date_start),
          currency: requireCurrency(d.account_currency, d.ad_id),
          spendMinor: toMinor(d.spend, 'spend'),
          impressions: toInt(d.impressions, 'impressions'),
          clicks: toInt(d.clicks, 'clicks'),
          linkClicks: d.inline_link_clicks == null ? null : toInt(d.inline_link_clicks, 'inline_link_clicks'),
          conversions: actionValue(d.actions, 'purchase') ?? 0,
          // Meta reports the same checkout start under several aliases (offsite_conversion.
          // fb_pixel_initiate_checkout, onsite_web_initiate_checkout, omni_initiated_checkout);
          // `initiate_checkout` is the deduplicated omni-channel total, so read only that one --
          // summing the aliases multiplies a single checkout by four.
          initiateCheckout: actionValue(d.actions, 'initiate_checkout'),
          conversionValueMinor: (() => {
            const v = actionValue(d.action_values, 'purchase');
            return v == null ? null : Math.round(v * 100);
          })(),
        });
      }
      pages += 1;
      const next = json.paging?.next ?? null;
      if (next && pages >= this.maxPages) return { rows, truncated: true };
      url = next;
    }

    return { rows, truncated: false };
  }

  private async fetchDestinationUrls(
    input: AdInsightsFetchInput,
    adIds: string[],
  ): Promise<{ linkByAdId: Map<string, string>; truncated: boolean }> {
    const out = new Map<string, string>();
    if (adIds.length === 0) return { linkByAdId: out, truncated: false };

    const q = new URLSearchParams({
      // link_destination_url is NOT a field on adcreative. Requesting it makes Meta reject the
      // whole call with "(#100) Tried accessing nonexisting field", which failed the entire sync
      // for any account that actually had ads. The link lives inside object_story_spec.
      fields: 'id,creative{object_story_spec,effective_object_story_id}',
      limit: '500',
      access_token: input.accessToken,
    });
    let url: string | null = `${GRAPH}/${input.externalAccountId}/ads?${q.toString()}`;
    let pages = 0;

    while (url) {
      const res = await this.fetchImpl(url);
      if (!res.ok) throw new Error(`META ads ${res.status}`);
      const json = (await res.json()) as { data?: any[]; paging?: { next?: string } };
      for (const d of json.data ?? []) {
        const creative = d.creative ?? {};
        const link =
          creative.object_story_spec?.link_data?.link ??
          creative.object_story_spec?.video_data?.call_to_action?.value?.link ??
          null;
        if (link) out.set(String(d.id), String(link));
      }
      pages += 1;
      const next = json.paging?.next ?? null;
      if (next && pages >= this.maxPages) return { linkByAdId: out, truncated: true };
      url = next;
    }

    return { linkByAdId: out, truncated: false };
  }
}
