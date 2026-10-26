import { describe, it, expect } from 'vitest';
import { buildFunnel } from './funnel-aggregate';
import type { FunnelStatsBag } from '@/contracts/stats';

const bag = (overrides: Partial<FunnelStatsBag>): FunnelStatsBag => ({
  lp1: 0,
  lp2: 0,
  lp3: 0,
  checkout: 0,
  totalUclick: 0,
  totalSuccess: 0,
  orders: 0,
  revenue: 0,
  upsell1: 0,
  upsell2: 0,
  upsell3: 0,
  enteringVisitors: 0,
  convertingVisitors: 0,
  ...overrides,
});

describe('buildFunnel headline Visitors + overallCvr', () => {
  it('uses the canonical session-distinct visitor counts (entering / converting)', () => {
    const out = buildFunnel(bag({ enteringVisitors: 5, convertingVisitors: 2, orders: 11, revenue: 338.88 }));
    expect(out.visitors).toBe(5);
    expect(out.overallCvr).toBe(40);
  });

  it('CVR is a visitor rate and never exceeds 100%', () => {
    const out = buildFunnel(bag({ enteringVisitors: 5, convertingVisitors: 5 }));
    expect(out.overallCvr).toBe(100);
    expect(out.overallCvr).toBeLessThanOrEqual(100);
  });

  it('caps converting at entering so a noisy signal cannot exceed 100%', () => {
    const out = buildFunnel(bag({ enteringVisitors: 3, convertingVisitors: 9 }));
    expect(out.overallCvr).toBe(100);
  });

  it('returns null cvr when there are no entering visitors', () => {
    const out = buildFunnel(bag({ enteringVisitors: 0, convertingVisitors: 0 }));
    expect(out.overallCvr).toBeNull();
  });

  it('does not let the funnel-stage lp1 column override the canonical visitor count', () => {
    const out = buildFunnel(bag({ lp1: 7, enteringVisitors: 5, convertingVisitors: 2 }));
    expect(out.visitors).toBe(5);
    expect(out.overallCvr).toBe(40);
  });

  it('falls back to the first landing-page count when the canonical field is absent', () => {
    const out = buildFunnel(bag({ lp1: 7, enteringVisitors: 0, convertingVisitors: 0 }));
    expect(out.visitors).toBe(7);
  });

  it('keeps the funnel stage bars sourced from funnel-events, not the visitor fields', () => {
    const out = buildFunnel(bag({ lp1: 7, enteringVisitors: 5, totalUclick: 4, totalSuccess: 3 }));
    const firstLp = out.stages.find((s) => s.key === 'firstLp');
    const payClicks = out.stages.find((s) => s.key === 'payClicks');
    expect(firstLp?.value).toBe(7);
    expect(payClicks?.value).toBe(4);
  });

  it('keeps orders and aov independent of the cvr definition', () => {
    const out = buildFunnel(bag({ enteringVisitors: 5, convertingVisitors: 2, orders: 11, revenue: 338.88 }));
    expect(out.orders).toBe(11);
    expect(out.aov).toBeCloseTo(338.88 / 11, 5);
  });
});

describe('buildFunnel with ad platform totals', () => {
  const ad = { impressions: 1131, linkClicks: 65, initiateCheckout: 9, conversions: 0, platformTimezones: ['America/Los_Angeles'] };

  it('prepends the two platform steps so the funnel starts at the impression', () => {
    const out = buildFunnel(bag({ lp1: 46 }), ad);
    expect(out.stages.map((s) => s.key).slice(0, 3)).toEqual(['adImpressions', 'adLinkClicks', 'firstLp']);
    expect(out.stages[0].value).toBe(1131);
    expect(out.stages[1].value).toBe(65);
  });

  it('measures the first onsite step against link clicks, which is the click-to-landing drop', () => {
    const out = buildFunnel(bag({ lp1: 46 }), ad);
    const firstLp = out.stages.find((s) => s.key === 'firstLp')!;
    expect(firstLp.conversionPct).toBeCloseTo((46 / 65) * 100, 5);
  });

  it('reports the platform count alongside our own on checkout and orders, never replacing it', () => {
    const out = buildFunnel(bag({ lp1: 46, checkout: 42, orders: 3 }), ad);
    const checkout = out.stages.find((s) => s.key === 'checkout')!;
    const orders = out.stages.find((s) => s.key === 'orders')!;
    expect(checkout.value).toBe(42);
    expect(checkout.platformValue).toBe(9);
    expect(orders.value).toBe(3);
    expect(orders.platformValue).toBe(0);
  });

  it('leaves the visitors KPI an onsite number even though the funnel now starts at impressions', () => {
    const out = buildFunnel(bag({ lp1: 46, enteringVisitors: 0 }), ad);
    expect(out.visitors).toBe(46);
  });

  it('adds no platform stages and no platform annotations when no ad data exists', () => {
    const out = buildFunnel(bag({ lp1: 46, checkout: 42 }));
    expect(out.stages[0].key).toBe('firstLp');
    expect(out.stages.every((s) => s.platformValue == null)).toBe(true);
  });

  it('keeps a null checkout-start annotation off the row when the platform does not report it', () => {
    const out = buildFunnel(bag({ lp1: 46, checkout: 42 }), { ...ad, initiateCheckout: null });
    expect(out.stages.find((s) => s.key === 'checkout')!.platformValue).toBeNull();
  });
});
