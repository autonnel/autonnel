import { describe, it, expect, vi } from 'vitest';

const { logger } = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ createLogger: () => logger }));

import { TikTokInsightsAdapter } from './insights.adapter';

const REPORT = {
  code: 0,
  data: {
    list: [
      {
        dimensions: { ad_id: '777', stat_time_day: '2026-09-11 00:00:00' },
        metrics: {
          ad_name: 'Glow Spark',
          campaign_id: '888',
          campaign_name: 'Glow Camp',
          adgroup_id: '999',
          adgroup_name: 'Glow Group',
          spend: '12.34',
          impressions: '1000',
          clicks: '120',
          conversion: '3',
          total_purchase_value: '150.50',
        },
      },
    ],
    page_info: { page: 1, total_page: 1 },
  },
};

const ADS = {
  code: 0,
  data: {
    list: [{ ad_id: '777', landing_page_url: 'https://shop.x.com/lp-glow?ttclid=x', operation_status: 'ENABLE' }],
    page_info: { page: 1, total_page: 1 },
  },
};

function stub(responses: unknown[]) {
  let i = 0;
  return vi.fn(async () => {
    const body = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  });
}

describe('TikTokInsightsAdapter.fetchAdInsights', () => {
  it('maps the daily report and joins the landing page url from /ad/get/', async () => {
    const { rows, truncated } = await new TikTokInsightsAdapter(stub([REPORT, ADS]) as never, 'USD').fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'adv-1',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(truncated).toBe(false);
    expect(rows[0]).toMatchObject({
      externalAdId: '777',
      name: 'Glow Spark',
      status: 'ENABLE',
      campaignExternalId: '888',
      adsetExternalId: '999',
      date: '2026-09-11',
      spendMinor: 1234,
      impressions: 1000,
      clicks: 120,
      linkClicks: null,
      conversions: 3,
      conversionValueMinor: 15050,
      destinationUrl: 'https://shop.x.com/lp-glow?ttclid=x',
    });
  });

  it('truncates stat_time_day to a date, because TikTok returns a datetime', async () => {
    const { rows } = await new TikTokInsightsAdapter(stub([REPORT, ADS]) as never, 'USD').fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'adv-1',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    expect(rows[0].date).toBe('2026-09-11');
  });

  it('throws when the envelope code is non-zero even though the HTTP status is 200', async () => {
    const bad = { code: 40001, message: 'invalid advertiser', data: {} };
    await expect(
      new TikTokInsightsAdapter(stub([bad]) as never, 'USD').fetchAdInsights({
        accessToken: 't',
        externalAccountId: 'adv-1',
        start: '2026-09-10',
        end: '2026-09-12',
      }),
    ).rejects.toThrow(/TIKTOK insights 40001/);
  });

  it('reports truncated when total_page exceeds the page cap', async () => {
    const many = { ...REPORT, data: { ...REPORT.data, page_info: { page: 1, total_page: 50 } } };
    const { truncated } = await new TikTokInsightsAdapter(stub([many, ADS]) as never, 'USD', 2).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'adv-1',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    expect(truncated).toBe(true);
  });
});

describe('TikTokInsightsAdapter.fetchAccountTimezone', () => {
  it('reads the advertiser timezone', async () => {
    const body = { code: 0, data: { list: [{ timezone: 'Asia/Shanghai', currency: 'USD' }] } };
    const tz = await new TikTokInsightsAdapter(stub([body]) as never, 'USD').fetchAccountTimezone({
      accessToken: 't',
      externalAccountId: 'adv-1',
    });
    expect(tz).toBe('Asia/Shanghai');
  });
});

describe('TikTokInsightsAdapter.fetchAdvertiserInfo', () => {
  it('returns both timezone and currency from the advertiser payload', async () => {
    const body = { code: 0, data: { list: [{ timezone: 'Asia/Shanghai', currency: 'EUR' }] } };
    const info = await new TikTokInsightsAdapter(stub([body]) as never, 'USD').fetchAdvertiserInfo({
      accessToken: 't',
      externalAccountId: 'adv-1',
    });
    expect(info).toEqual({ timezone: 'Asia/Shanghai', currency: 'EUR' });
  });

  it('returns nulls rather than throwing when a field is absent from the advertiser payload', async () => {
    const body = { code: 0, data: { list: [{}] } };
    const info = await new TikTokInsightsAdapter(stub([body]) as never, 'USD').fetchAdvertiserInfo({
      accessToken: 't',
      externalAccountId: 'adv-1',
    });
    expect(info).toEqual({ timezone: null, currency: null });
  });

  it('fetchAccountTimezone still returns just the timezone, delegating to fetchAdvertiserInfo', async () => {
    const body = { code: 0, data: { list: [{ timezone: 'America/Los_Angeles', currency: 'GBP' }] } };
    const tz = await new TikTokInsightsAdapter(stub([body]) as never, 'USD').fetchAccountTimezone({
      accessToken: 't',
      externalAccountId: 'adv-1',
    });
    expect(tz).toBe('America/Los_Angeles');
  });
});

function reportFor(adIds: string[], spendPerAd: string) {
  return {
    code: 0,
    data: {
      list: adIds.map((id) => ({
        dimensions: { ad_id: id, stat_time_day: '2026-09-11 00:00:00' },
        metrics: { ad_name: `Ad ${id}`, spend: spendPerAd, impressions: '10', clicks: '1' },
      })),
      page_info: { page: 1, total_page: 1 },
    },
  };
}

function batchAwareFetch(report: unknown) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    if (url.includes('/report/integrated/get/')) {
      return { ok: true, status: 200, json: async () => report } as unknown as Response;
    }
    const parsed = new URL(url);
    const filtering = JSON.parse(parsed.searchParams.get('filtering') ?? '{}');
    const list = (filtering.ad_ids ?? []).map((id: string) => ({
      ad_id: id,
      landing_page_url: `https://shop.x.com/lp-${id}`,
      operation_status: 'ENABLE',
    }));
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: { list, page_info: { page: 1, total_page: 1 } } }),
    } as unknown as Response;
  });
  return { impl, calls };
}

describe('TikTokInsightsAdapter ad-meta batching', () => {
  it('splits more than 100 ad ids into batches of at most 100 for /ad/get/, merging results across batches', async () => {
    const adIds = Array.from({ length: 150 }, (_, i) => String(i + 1));
    const { impl, calls } = batchAwareFetch(reportFor(adIds, '1.00'));

    const { rows, truncated } = await new TikTokInsightsAdapter(impl as never, 'USD').fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'adv-1',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    const adMetaCalls = calls.filter((u) => u.includes('/ad/get/'));
    expect(adMetaCalls).toHaveLength(2);
    expect(truncated).toBe(false);
    expect(rows).toHaveLength(150);
    expect(rows.find((r) => r.externalAdId === '1')?.destinationUrl).toBe('https://shop.x.com/lp-1');
    expect(rows.find((r) => r.externalAdId === '150')?.destinationUrl).toBe('https://shop.x.com/lp-150');
  });

  it('reports truncated, without dropping spend, when the page cap interrupts ad-meta batching mid-way', async () => {
    const adIds = Array.from({ length: 150 }, (_, i) => String(i + 1));
    const { impl, calls } = batchAwareFetch(reportFor(adIds, '2.50'));

    // maxPages=1 lets the first 100-id batch through but stops before the second (ids 101-150).
    const { rows, truncated } = await new TikTokInsightsAdapter(impl as never, 'USD', 1).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'adv-1',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(calls.filter((u) => u.includes('/ad/get/'))).toHaveLength(1);
    expect(truncated).toBe(true);
    const first = rows.find((r) => r.externalAdId === '1');
    const last = rows.find((r) => r.externalAdId === '150');
    expect(first?.destinationUrl).toBe('https://shop.x.com/lp-1');
    expect(last?.destinationUrl).toBeNull();
    expect(last?.spendMinor).toBe(250);
  });
});

describe('TikTokInsightsAdapter numeric field parsing', () => {
  it('logs a warning and defaults to 0 instead of throwing when spend does not parse as a number', async () => {
    logger.warn.mockClear();
    const malformed = {
      ...REPORT,
      data: {
        ...REPORT.data,
        list: [{ ...REPORT.data.list[0], metrics: { ...REPORT.data.list[0].metrics, spend: '1,234.56' } }],
      },
    };
    const { rows } = await new TikTokInsightsAdapter(stub([malformed, ADS]) as never, 'USD').fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'adv-1',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(rows[0].spendMinor).toBe(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), { field: 'spend', value: '1,234.56' });
  });

  it('defaults conversionValueMinor to null without warning when total_purchase_value is absent', async () => {
    logger.warn.mockClear();
    const noValue = {
      ...REPORT,
      data: {
        ...REPORT.data,
        list: [
          {
            ...REPORT.data.list[0],
            metrics: { ...REPORT.data.list[0].metrics, total_purchase_value: undefined },
          },
        ],
      },
    };
    const { rows } = await new TikTokInsightsAdapter(stub([noValue, ADS]) as never, 'USD').fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'adv-1',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(rows[0].conversionValueMinor).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('TikTokInsightsAdapter lazy currency resolution', () => {
  const ADVERTISER_INFO = { code: 0, data: { list: [{ timezone: 'Asia/Shanghai', currency: 'EUR' }] } };

  it('resolves currency via fetchAdvertiserInfo when constructed with null, then stamps rows with it', async () => {
    const fetchImpl = stub([ADVERTISER_INFO, REPORT, ADS]);
    const { rows } = await new TikTokInsightsAdapter(fetchImpl as never, null).fetchAdInsights({
      accessToken: 't',
      externalAccountId: 'adv-1',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(rows[0].currency).toBe('EUR');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('resolves currency only once across repeated calls, since it is an advertiser-level constant', async () => {
    const fetchImpl = stub([ADVERTISER_INFO, REPORT, ADS, REPORT, ADS]);
    const adapter = new TikTokInsightsAdapter(fetchImpl as never, null);
    const input = { accessToken: 't', externalAccountId: 'adv-1', start: '2026-09-10', end: '2026-09-12' };

    const first = await adapter.fetchAdInsights(input);
    const second = await adapter.fetchAdInsights(input);

    expect(first.rows[0].currency).toBe('EUR');
    expect(second.rows[0].currency).toBe('EUR');
    // 1 advertiser-info call total, plus 2 calls (report + ads) per fetchAdInsights invocation.
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('throws instead of defaulting when the advertiser payload has no currency either', async () => {
    const noCurrency = { code: 0, data: { list: [{ timezone: 'Asia/Shanghai' }] } };
    const fetchImpl = stub([noCurrency]);
    await expect(
      new TikTokInsightsAdapter(fetchImpl as never, null).fetchAdInsights({
        accessToken: 't',
        externalAccountId: 'adv-1',
        start: '2026-09-10',
        end: '2026-09-12',
      }),
    ).rejects.toThrow(/no currency/);
  });
});
