import { describe, it, expect } from 'vitest';
import {
  aggregateAnalyticsKpi,
  aggregateFunnelSteps,
  aggregateMethodStats,
  aggregateTrafficSources,
  conversionRate,
  deriveTrafficSource,
  formatMoney,
  formatPercent,
  statusBadgeClasses,
} from '@/lib/dashboard/analytics-helpers';

const NOW = new Date('2026-04-24T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('conversionRate', () => {
  it('returns 0 when visits is zero or negative', () => {
    expect(conversionRate(5, 0)).toBe(0);
    expect(conversionRate(0, 0)).toBe(0);
    expect(conversionRate(5, -1)).toBe(0);
  });
  it('returns orders / visits * 100', () => {
    expect(conversionRate(5, 100)).toBe(5);
    expect(conversionRate(1, 4)).toBe(25);
  });
});

describe('aggregateAnalyticsKpi', () => {
  it('returns zeros on empty input', () => {
    const k = aggregateAnalyticsKpi({ visits: [], orders: [], now: NOW });
    expect(k.visits24h).toBe(0);
    expect(k.orders24h).toBe(0);
    expect(k.revenue24h).toBe(0);
    expect(k.conversionRate24h).toBe(0);
  });

  it('buckets visits and paid orders into 24h vs prior 24h windows', () => {
    const k = aggregateAnalyticsKpi({
      now: NOW,
      visits: [
        { createdAt: new Date(NOW.getTime() - 1 * HOUR) },
        { createdAt: new Date(NOW.getTime() - 12 * HOUR) },
        { createdAt: new Date(NOW.getTime() - 30 * HOUR) },
        { createdAt: new Date(NOW.getTime() - 50 * HOUR) },
      ],
      orders: [
        { paidAt: new Date(NOW.getTime() - 2 * HOUR), status: 'PAID', totalUSD: '100' },
        { paidAt: new Date(NOW.getTime() - 30 * HOUR), status: 'PAID', totalUSD: 50 },
        { paidAt: null, status: 'PENDING', totalUSD: 999 },
      ],
    });
    expect(k.visits24h).toBe(2);
    expect(k.visitsPrev24h).toBe(1);
    expect(k.orders24h).toBe(1);
    expect(k.ordersPrev24h).toBe(1);
    expect(k.revenue24h).toBe(100);
    expect(k.revenuePrev24h).toBe(50);
    expect(k.conversionRate24h).toBe(50);
    expect(k.conversionRatePrev24h).toBe(100);
  });

  it('skips invalid totalUSD values', () => {
    const k = aggregateAnalyticsKpi({
      now: NOW,
      visits: [],
      orders: [
        { paidAt: new Date(NOW.getTime() - HOUR), status: 'PAID', totalUSD: 'not-a-number' },
      ],
    });
    expect(k.revenue24h).toBe(0);
  });
});

describe('aggregateFunnelSteps', () => {
  it('returns step rows even on empty input', () => {
    const rows = aggregateFunnelSteps({ visits: [] });
    expect(rows.length).toBe(6);
    expect(rows.map((r) => r.key)).toEqual(['lp1', 'lp2', 'lp3', 'checkout', 'upsell', 'thankyou']);
    expect(rows.every((r) => r.count === 0)).toBe(true);
  });

  it('counts visits per page type and computes drop rates', () => {
    const rows = aggregateFunnelSteps({
      visits: [
        ...Array(100).fill({ pageType: 'LANDING' }),
        ...Array(60).fill({ pageType: 'CHECKOUT' }),
        ...Array(20).fill({ pageType: 'THANKYOU' }),
      ],
    });
    const lp1 = rows.find((r) => r.key === 'lp1')!;
    const checkout = rows.find((r) => r.key === 'checkout')!;
    const thankyou = rows.find((r) => r.key === 'thankyou')!;
    expect(lp1.count).toBe(100);
    expect(lp1.dropRate).toBe(0);
    expect(checkout.count).toBe(60);
    // checkout drops from lp3 (=0). Drop rate vs prev step would be 0 (prev is 0).
    expect(thankyou.count).toBe(20);
    // thankyou drops from upsell (which is 0). dropRate=0 because prev=0
    expect(thankyou.dropRate).toBe(0);
  });

  it('matches lowercase page types too', () => {
    const rows = aggregateFunnelSteps({
      visits: [
        { pageType: 'lp1' },
        { pageType: 'lp1' },
        { pageType: 'checkout' },
      ],
    });
    expect(rows.find((r) => r.key === 'lp1')?.count).toBe(2);
    expect(rows.find((r) => r.key === 'checkout')?.count).toBe(1);
  });

  it('groups upsell variants together', () => {
    const rows = aggregateFunnelSteps({
      visits: [
        { pageType: 'UPSELL1' },
        { pageType: 'UPSELL2' },
        { pageType: 'UPSELL3' },
      ],
    });
    expect(rows.find((r) => r.key === 'upsell')?.count).toBe(3);
  });
});

describe('aggregateMethodStats', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateMethodStats({ orders: [] })).toEqual([]);
  });

  it('counts submits / successes / failures and revenue', () => {
    const rows = aggregateMethodStats({
      orders: [
        { paymentMethod: 'paypal', status: 'PAID',     totalUSD: 100 },
        { paymentMethod: 'paypal', status: 'PAID',     totalUSD: '50' },
        { paymentMethod: 'paypal', status: 'CANCELLED', totalUSD: 0 },
        { paymentMethod: 'card',   status: 'FAILED',   totalUSD: 0 },
        { paymentMethod: 'card',   status: 'PAID',     totalUSD: 200 },
        { paymentMethod: null,     status: 'PAID',     totalUSD: 25 },
      ],
    });
    const paypal = rows.find((r) => r.method === 'paypal')!;
    expect(paypal.submits).toBe(3);
    expect(paypal.successes).toBe(2);
    expect(paypal.failures).toBe(1);
    expect(paypal.revenue).toBe(150);
    expect(paypal.successRate).toBeCloseTo(66.6666, 2);
    expect(paypal.label).toBe('PayPal');

    const card = rows.find((r) => r.method === 'card')!;
    expect(card.submits).toBe(2);
    expect(card.successes).toBe(1);
    expect(card.failures).toBe(1);
    expect(card.successRate).toBe(50);

    const other = rows.find((r) => r.method === 'other')!;
    expect(other.submits).toBe(1);
    expect(other.successes).toBe(1);
  });

  it('sorts results by submits desc', () => {
    const rows = aggregateMethodStats({
      orders: [
        { paymentMethod: 'card',   status: 'PAID', totalUSD: 0 },
        { paymentMethod: 'paypal', status: 'PAID', totalUSD: 0 },
        { paymentMethod: 'paypal', status: 'PAID', totalUSD: 0 },
      ],
    });
    expect(rows[0].method).toBe('paypal');
  });
});

describe('deriveTrafficSource / aggregateTrafficSources', () => {
  it('uses trafficSource when present', () => {
    expect(deriveTrafficSource('facebook', null)).toBe('FACEBOOK');
    expect(deriveTrafficSource('TIKTOK', null)).toBe('TIKTOK');
  });

  it('falls back to URL params (fbclid → FACEBOOK, etc.)', () => {
    expect(deriveTrafficSource(null, { fbclid: 'a' })).toBe('FACEBOOK');
    expect(deriveTrafficSource(null, { ttclid: 'a' })).toBe('TIKTOK');
    expect(deriveTrafficSource(null, { gclid: 'a' })).toBe('GOOGLE_ADS');
    expect(deriveTrafficSource(null, { msclkid: 'a' })).toBe('BING_ADS');
    expect(deriveTrafficSource(null, { utm_source: 'newsletter' })).toBe('NEWSLETTER');
    expect(deriveTrafficSource(null, null)).toBe('UNKNOWN');
    expect(deriveTrafficSource(null, {})).toBe('UNKNOWN');
  });

  it('aggregates visits and orders by source', () => {
    const rows = aggregateTrafficSources({
      visits: [
        { trafficSource: 'FACEBOOK' },
        { trafficSource: 'FACEBOOK' },
        { trafficSource: 'TIKTOK' },
        { urlParams: { gclid: 'x' } },
      ],
      orders: [
        { trafficSource: 'FACEBOOK', status: 'PAID', totalUSD: 100 },
        { trafficSource: 'FACEBOOK', status: 'PENDING', totalUSD: 999 }, // not paid: skipped
        { trafficSource: 'TIKTOK',   status: 'DELIVERED', totalUSD: 50 },
      ],
    });
    const fb = rows.find((r) => r.source === 'FACEBOOK')!;
    expect(fb.visits).toBe(2);
    expect(fb.orders).toBe(1);
    expect(fb.revenue).toBe(100);
    expect(fb.label).toBe('Facebook');

    const tt = rows.find((r) => r.source === 'TIKTOK')!;
    expect(tt.visits).toBe(1);
    expect(tt.orders).toBe(1);

    const ga = rows.find((r) => r.source === 'GOOGLE_ADS')!;
    expect(ga.visits).toBe(1);
    expect(ga.orders).toBe(0);
  });

  it('sorts by visits desc', () => {
    const rows = aggregateTrafficSources({
      visits: [
        { trafficSource: 'TIKTOK' },
        { trafficSource: 'FACEBOOK' },
        { trafficSource: 'FACEBOOK' },
      ],
      orders: [],
    });
    expect(rows[0].source).toBe('FACEBOOK');
  });
});

describe('formatPercent / formatMoney / statusBadgeClasses', () => {
  it('formats percentages', () => {
    expect(formatPercent(12.345)).toBe('12.35%');
    expect(formatPercent(0)).toBe('0.00%');
    expect(formatPercent(NaN)).toBe('0.00%');
    expect(formatPercent(50, 0)).toBe('50%');
  });

  it('formats USD by default with thousands', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney('99.9')).toBe('$99.90');
    expect(formatMoney(100, 'EUR')).toBe('100.00 EUR');
    expect(formatMoney(null)).toBe('$0.00');
  });

  it('returns class strings per tone', () => {
    expect(statusBadgeClasses('ok')).toContain('ds-okBg');
    expect(statusBadgeClasses('warn')).toContain('ds-warnBg');
    expect(statusBadgeClasses('bad')).toContain('ds-badBg');
    expect(statusBadgeClasses('muted')).toContain('ds-muted');
    expect(statusBadgeClasses('default')).toContain('ds-slate');
  });
});
