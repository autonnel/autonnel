import { describe, it, expect, vi } from 'vitest';

const { logger } = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ createLogger: () => logger }));

import { GoogleAdsInsightsAdapter } from './insights.adapter';

const PAGE = {
  results: [
    {
      adGroupAd: {
        ad: { id: '111', name: 'Glow RSA', finalUrls: ['https://shop.x.com/lp-glow?gclid=x'] },
        status: 'ENABLED',
      },
      campaign: { id: '222', name: 'Glow Camp' },
      adGroup: { id: '333', name: 'Glow Group' },
      customer: { currencyCode: 'USD' },
      segments: { date: '2026-09-11' },
      metrics: {
        costMicros: '12340000',
        impressions: '1000',
        clicks: '120',
        conversions: 3.5,
        conversionsValue: 150.5,
      },
    },
  ],
};

function stub(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);
}

describe('GoogleAdsInsightsAdapter.fetchAdInsights', () => {
  it('maps micros to minor units and reads the destination url from finalUrls', async () => {
    const impl = stub(PAGE);
    const { rows, truncated } = await new GoogleAdsInsightsAdapter(impl as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: '1234567890',
      developerToken: 'dev',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(truncated).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      externalAdId: '111',
      name: 'Glow RSA',
      status: 'ENABLED',
      campaignExternalId: '222',
      adsetExternalId: '333',
      date: '2026-09-11',
      currency: 'USD',
      spendMinor: 1234,
      impressions: 1000,
      clicks: 120,
      conversions: 3.5,
      conversionValueMinor: 15050,
      destinationUrl: 'https://shop.x.com/lp-glow?gclid=x',
    });
  });

  it('reports linkClicks as null because Google Ads has no separate link-click metric', async () => {
    const { rows } = await new GoogleAdsInsightsAdapter(stub(PAGE) as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: '1',
      developerToken: 'dev',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    expect(rows[0].linkClicks).toBeNull();
  });

  it('keeps fractional conversions, which are how modeled conversions surface', async () => {
    const { rows } = await new GoogleAdsInsightsAdapter(stub(PAGE) as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: '1',
      developerToken: 'dev',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    expect(rows[0].conversions).toBe(3.5);
  });

  it('sends the developer token and the login customer id headers', async () => {
    const impl = stub(PAGE);
    await new GoogleAdsInsightsAdapter(impl as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: '1',
      developerToken: 'dev',
      loginCustomerId: '999',
      start: '2026-09-10',
      end: '2026-09-12',
    });
    const init = (impl.mock.calls[0] as any)[1];
    expect(init.headers['developer-token']).toBe('dev');
    expect(init.headers['login-customer-id']).toBe('999');
  });

  it('throws without a developer token instead of issuing a request that always 401s', async () => {
    const impl = stub(PAGE);
    await expect(
      new GoogleAdsInsightsAdapter(impl as never).fetchAdInsights({
        accessToken: 't',
        externalAccountId: '1',
        start: '2026-09-10',
        end: '2026-09-12',
      }),
    ).rejects.toThrow(/developer token/i);
    expect(impl).not.toHaveBeenCalled();
  });

  it('refuses to guess a currency when customer.currencyCode is missing, instead of defaulting to USD', async () => {
    const noCurrency = { results: [{ ...PAGE.results[0], customer: {} }] };
    await expect(
      new GoogleAdsInsightsAdapter(stub(noCurrency) as never).fetchAdInsights({
        accessToken: 't',
        externalAccountId: '1234567890',
        developerToken: 'dev',
        start: '2026-09-10',
        end: '2026-09-12',
      }),
    ).rejects.toThrow(/refusing to guess/);
  });

  it('throws on a non-ok response', async () => {
    await expect(
      new GoogleAdsInsightsAdapter(stub({}, false, 403) as never).fetchAdInsights({
        accessToken: 't',
        externalAccountId: '1',
        developerToken: 'dev',
        start: '2026-09-10',
        end: '2026-09-12',
      }),
    ).rejects.toThrow(/GOOGLE insights 403/);
  });
});

describe('GoogleAdsInsightsAdapter.fetchAccountTimezone', () => {
  it('reads customer.timeZone', async () => {
    const impl = stub({ results: [{ customer: { timeZone: 'America/New_York' } }] });
    const tz = await new GoogleAdsInsightsAdapter(impl as never).fetchAccountTimezone({
      accessToken: 't',
      externalAccountId: '1',
      developerToken: 'dev',
    });
    expect(tz).toBe('America/New_York');
  });
});

function chunkFor(id: string, costMicros: string) {
  return {
    results: [
      {
        adGroupAd: { ad: { id, name: `Ad ${id}`, finalUrls: [] }, status: 'ENABLED' },
        campaign: { id: '222', name: 'Glow Camp' },
        adGroup: { id: '333', name: 'Glow Group' },
        customer: { currencyCode: 'USD' },
        segments: { date: '2026-09-11' },
        metrics: { costMicros, impressions: '10', clicks: '1', conversions: 1 },
      },
    ],
  };
}

describe('GoogleAdsInsightsAdapter searchStream chunk cap', () => {
  it('reports truncated true and keeps only rows from chunks within the cap when chunk count exceeds maxPages', async () => {
    const chunks = [
      chunkFor('1', '10000'),
      chunkFor('2', '20000'),
      chunkFor('3', '30000'),
      chunkFor('4', '40000'),
      chunkFor('5', '50000'),
    ];
    const { rows, truncated } = await new GoogleAdsInsightsAdapter(stub(chunks) as never, 3).fetchAdInsights({
      accessToken: 't',
      externalAccountId: '1',
      developerToken: 'dev',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(truncated).toBe(true);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.externalAdId)).toEqual(['1', '2', '3']);
    expect(rows[0].spendMinor).toBe(1);
    expect(rows[2].spendMinor).toBe(3);
  });

  it('reports truncated false when chunk count is at or below maxPages', async () => {
    const chunks = [chunkFor('1', '10000'), chunkFor('2', '20000'), chunkFor('3', '30000')];
    const { rows, truncated } = await new GoogleAdsInsightsAdapter(stub(chunks) as never, 3).fetchAdInsights({
      accessToken: 't',
      externalAccountId: '1',
      developerToken: 'dev',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(truncated).toBe(false);
    expect(rows).toHaveLength(3);
  });
});

describe('GoogleAdsInsightsAdapter malformed numeric fields', () => {
  it('logs a warning and defaults spendMinor to 0 instead of throwing when costMicros does not parse as a number', async () => {
    logger.warn.mockClear();
    const malformedPage = {
      results: [
        {
          adGroupAd: { ad: { id: '111', name: 'Glow RSA', finalUrls: [] }, status: 'ENABLED' },
          campaign: { id: '222', name: 'Glow Camp' },
          adGroup: { id: '333', name: 'Glow Group' },
          customer: { currencyCode: 'USD' },
          segments: { date: '2026-09-11' },
          metrics: { costMicros: '12,340,000', clicks: '120', conversions: 3.5 },
        },
      ],
    };
    const { rows } = await new GoogleAdsInsightsAdapter(stub(malformedPage) as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: '1',
      developerToken: 'dev',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(rows[0].spendMinor).toBe(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), { field: 'costMicros', value: '12,340,000' });
  });

  it('does not warn when an optional numeric field like impressions is simply absent', async () => {
    logger.warn.mockClear();
    const absentFieldPage = {
      results: [
        {
          adGroupAd: { ad: { id: '111', name: 'Glow RSA', finalUrls: [] }, status: 'ENABLED' },
          campaign: { id: '222', name: 'Glow Camp' },
          adGroup: { id: '333', name: 'Glow Group' },
          customer: { currencyCode: 'USD' },
          segments: { date: '2026-09-11' },
          metrics: { costMicros: '12340000', clicks: '120', conversions: 3.5 },
        },
      ],
    };
    const { rows } = await new GoogleAdsInsightsAdapter(stub(absentFieldPage) as never).fetchAdInsights({
      accessToken: 't',
      externalAccountId: '1',
      developerToken: 'dev',
      start: '2026-09-10',
      end: '2026-09-12',
    });

    expect(rows[0].impressions).toBe(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
