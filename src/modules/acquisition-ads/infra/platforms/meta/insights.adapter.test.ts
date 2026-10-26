import { describe, it, expect, vi } from 'vitest';

const { logger } = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ createLogger: () => logger }));

import { MetaInsightsAdapter } from './insights.adapter';

const INSIGHTS_PAGE = {
  data: [
    {
      ad_id: 'ad-1',
      ad_name: 'Glow Ad',
      campaign_id: 'camp-1',
      campaign_name: 'Glow Camp',
      adset_id: 'set-1',
      adset_name: 'Glow Set',
      date_start: '2026-09-11',
      spend: '12.34',
      impressions: '1000',
      clicks: '120',
      inline_link_clicks: '95',
      account_currency: 'USD',
      actions: [
        { action_type: 'purchase', value: '3' },
        { action_type: 'landing_page_view', value: '80' },
        { action_type: 'initiate_checkout', value: '9' },
        { action_type: 'offsite_conversion.fb_pixel_initiate_checkout', value: '9' },
        { action_type: 'onsite_web_initiate_checkout', value: '9' },
        { action_type: 'omni_initiated_checkout', value: '9' },
      ],
      action_values: [{ action_type: 'purchase', value: '150.50' }],
    },
  ],
  paging: {},
};

const CREATIVE_PAGE = {
  data: [
    { id: 'ad-1', creative: { object_story_spec: { link_data: { link: 'https://shop.x.com/lp-glow?utm_source=fb' } } } },
  ],
  paging: {},
};

function fetchStub(responses: unknown[]) {
  const calls: string[] = [];
  let i = 0;
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    const body = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  });
  return { impl, calls };
}

describe('MetaInsightsAdapter.fetchAdInsights', () => {
  it('maps one insight row per ad per day, in minor units', async () => {
    const { impl } = fetchStub([INSIGHTS_PAGE, CREATIVE_PAGE]);
    const adapter = new MetaInsightsAdapter(impl as never);
    const { rows, truncated } = await adapter.fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'act_1',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(truncated).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      externalAdId: 'ad-1',
      name: 'Glow Ad',
      campaignExternalId: 'camp-1',
      adsetExternalId: 'set-1',
      date: '2026-09-11',
      currency: 'USD',
      spendMinor: 1234,
      impressions: 1000,
      clicks: 120,
      linkClicks: 95,
      conversions: 3,
      initiateCheckout: 9,
      conversionValueMinor: 15050,
      destinationUrl: 'https://shop.x.com/lp-glow?utm_source=fb',
    });
  });

  it('reads only the deduplicated initiate_checkout action, never the sum of its platform aliases', async () => {
    const { impl } = fetchStub([INSIGHTS_PAGE, CREATIVE_PAGE]);
    const { rows } = await new MetaInsightsAdapter(impl as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'act_1',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    // The fixture carries the same 9 checkouts under four action_type aliases.
    expect(rows[0].initiateCheckout).toBe(9);
  });

  it('reports a missing checkout-start action as null, not 0, so the UI can show it as unreported', async () => {
    const page = { data: [{ ...INSIGHTS_PAGE.data[0], actions: [{ action_type: 'purchase', value: '3' }] }], paging: {} };
    const { impl } = fetchStub([page, CREATIVE_PAGE]);
    const { rows } = await new MetaInsightsAdapter(impl as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'act_1',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    expect(rows[0].initiateCheckout).toBeNull();
  });

  it('requests the daily breakdown, otherwise the window collapses into one aggregate row', async () => {
    const { impl, calls } = fetchStub([INSIGHTS_PAGE, CREATIVE_PAGE]);
    await new MetaInsightsAdapter(impl as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'act_1',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    expect(calls[0]).toContain('time_increment=1');
    expect(calls[0]).toContain('level=ad');
  });

  it('leaves destinationUrl null when the creative has no link instead of dropping the row', async () => {
    const { impl } = fetchStub([INSIGHTS_PAGE, { data: [{ id: 'ad-1', creative: {} }], paging: {} }]);
    const { rows } = await new MetaInsightsAdapter(impl as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'act_1',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    expect(rows[0].destinationUrl).toBeNull();
    expect(rows[0].spendMinor).toBe(1234);
  });

  it('refuses to guess a currency when account_currency is missing, instead of defaulting to USD', async () => {
    const noCurrency = { data: [{ ...INSIGHTS_PAGE.data[0], account_currency: undefined }], paging: {} };
    const { impl } = fetchStub([noCurrency, CREATIVE_PAGE]);
    await expect(
      new MetaInsightsAdapter(impl as never).fetchAdInsights({
        accessToken: 't',
        externalAccountId: 'act_1',
        start: '2026-09-10',
        end: '2026-09-12',
      }),
    ).rejects.toThrow(/refusing to guess/);
  });

  it('reports truncated when it stops at the page cap', async () => {
    const paged = { ...INSIGHTS_PAGE, paging: { next: 'https://graph.facebook.com/next' } };
    const { impl } = fetchStub([paged]);
    const { truncated } = await new MetaInsightsAdapter(impl as never, 2).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'act_1',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    expect(truncated).toBe(true);
  });

  it('reports truncated from a capped /ads join alone, while insights pagination is not capped, and keeps spend for the ad whose link the cap dropped', async () => {
    const twoAdInsights = {
      data: [
        INSIGHTS_PAGE.data[0],
        {
          ad_id: 'ad-2',
          ad_name: 'Bloom Ad',
          campaign_id: 'camp-1',
          campaign_name: 'Glow Camp',
          adset_id: 'set-1',
          adset_name: 'Glow Set',
          date_start: '2026-09-11',
          spend: '56.78',
          impressions: '2000',
          clicks: '200',
          inline_link_clicks: '150',
          account_currency: 'USD',
          actions: [],
          action_values: [],
        },
      ],
      // No `next`: the insights loop finishes in one page regardless of maxPages.
      paging: {},
    };
    // Only ad-1's creative is on this page; ad-2's would be on a second /ads page that the
    // maxPages=1 cap below stops the adapter from ever requesting.
    const cappedAdsPage = {
      data: [{ id: 'ad-1', creative: { object_story_spec: { link_data: { link: 'https://shop.x.com/lp-glow' } } } }],
      paging: { next: 'https://graph.facebook.com/adsnext' },
    };
    const calls: string[] = [];
    const impl = vi.fn(async (url: string) => {
      calls.push(url);
      const body = url.includes('/insights') ? twoAdInsights : cappedAdsPage;
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    });

    const { rows, truncated } = await new MetaInsightsAdapter(impl as never, 1).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'act_1',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(truncated).toBe(true);
    const ad1 = rows.find((r) => r.externalAdId === 'ad-1');
    const ad2 = rows.find((r) => r.externalAdId === 'ad-2');
    expect(ad1?.destinationUrl).toBe('https://shop.x.com/lp-glow');
    expect(ad1?.spendMinor).toBe(1234);
    // ad-2's link never arrived (its /ads page was past the cap), but its spend must survive.
    expect(ad2?.destinationUrl).toBeNull();
    expect(ad2?.spendMinor).toBe(5678);
  });

  it('logs a warning and defaults to 0 instead of throwing when spend does not parse as a number', async () => {
    logger.warn.mockClear();
    const malformedSpend = {
      ...INSIGHTS_PAGE,
      data: [{ ...INSIGHTS_PAGE.data[0], spend: '1,234.56' }],
    };
    const { impl } = fetchStub([malformedSpend, CREATIVE_PAGE]);
    const { rows } = await new MetaInsightsAdapter(impl as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'act_1',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(rows[0].spendMinor).toBe(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), { field: 'spend', value: '1,234.56' });
  });

  it('throws on a non-ok response so the caller records a failed sync run', async () => {
    const impl = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) }) as unknown as Response);
    await expect(
      new MetaInsightsAdapter(impl as never).fetchAdInsights({
        accessToken: 't',
        externalAccountId: 'act_1',
        start: '2026-09-10',
        end: '2026-09-12',
      }),
    ).rejects.toThrow(/META insights 400/);
  });
});

describe('MetaInsightsAdapter /ads field selection', () => {
  // Meta rejects the whole request with "(#100) Tried accessing nonexisting field
  // (link_destination_url)" because that field does not exist on adcreative. Requesting it made
  // every account that actually HAS ads fail its entire sync, while empty accounts passed because
  // the /ads hop is skipped when there are no ad ids.
  it('never requests link_destination_url, a field adcreative does not have', async () => {
    const { impl, calls } = fetchStub([INSIGHTS_PAGE, CREATIVE_PAGE]);
    await new MetaInsightsAdapter(impl as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'act_1',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    const adsCall = calls.find((u) => u.includes('/ads?'));
    expect(adsCall).toBeDefined();
    expect(decodeURIComponent(adsCall as string)).not.toContain('link_destination_url');
  });
});

describe('MetaInsightsAdapter.fetchAccountTimezone', () => {
  it('reads timezone_name off the ad account', async () => {
    const impl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ timezone_name: 'America/Los_Angeles' }),
    }) as unknown as Response);
    const tz = await new MetaInsightsAdapter(impl as never).fetchAccountTimezone({
      accessToken: 't',
      externalAccountId: 'act_1',
    });
    expect(tz).toBe('America/Los_Angeles');
  });
});
