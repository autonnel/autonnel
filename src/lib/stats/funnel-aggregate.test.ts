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
