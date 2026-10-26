import { describe, it, expect } from 'vitest';
import { DEPTH_BANDS } from '@/lib/stats/engagement';
import { aggregateInterest, type InterestVisit } from '@/lib/dashboard/interest-data';

function visit(over: Partial<InterestVisit> = {}): InterestVisit {
  return {
    pageId: 'p1',
    funnelId: 'f1',
    dwellMs: 30_000,
    activeMs: 20_000,
    maxScrollPct: 60,
    viewportPct: 5,
    dwellByDepth: new Array(DEPTH_BANDS).fill(1_000),
    interactions: [],
    ...over,
  };
}

describe('aggregateInterest', () => {
  it('counts one row per page and classifies each visit', () => {
    const out = aggregateInterest([
      visit(),
      visit({ dwellMs: 1_000, activeMs: 500, maxScrollPct: 2 }),
      visit({ pageId: 'p2' }),
    ]);
    expect(out.get('p1')!.uv).toBe(2);
    expect(out.get('p1')!.counts.ENGAGED).toBe(1);
    expect(out.get('p1')!.counts.BOUNCED).toBe(1);
    expect(out.get('p2')!.uv).toBe(1);
  });

  it('medians the foreground clock, not wall clock', () => {
    const out = aggregateInterest([visit({ dwellMs: 600_000, activeMs: 4_000 })]);
    expect(out.get('p1')!.medianDwellMs).toBe(4_000);
  });

  it('falls back to wall clock and reports the mixed coverage', () => {
    const out = aggregateInterest([visit({ activeMs: null }), visit()]);
    expect(out.get('p1')!.activeCoverage).toBe(0.5);
  });

  it('medians the page height rather than averaging it', () => {
    // One phone in landscape should not resize the page.
    const out = aggregateInterest([
      visit({ viewportPct: 5 }),
      visit({ viewportPct: 5 }),
      visit({ viewportPct: 50 }),
    ]);
    expect(out.get('p1')!.screensTall).toBe(20);
    expect(out.get('p1')!.screensCoverage).toBe(1);
  });

  it('reports no bands at all when nobody measured them', () => {
    // Rows of zeros would draw a page nobody looked at.
    const out = aggregateInterest([visit({ dwellByDepth: [] })]);
    expect(out.get('p1')!.bands).toEqual([]);
  });

  it('counts reach only for bands that were actually on screen', () => {
    const dwell = new Array(DEPTH_BANDS).fill(0);
    dwell[0] = 900;
    dwell[1] = 100;
    const out = aggregateInterest([visit({ dwellByDepth: dwell })]);
    const bands = out.get('p1')!.bands;
    expect(bands[0].reached).toBe(1);
    expect(bands[2].reached).toBe(0);
    expect(bands[0].medianVisibleMs).toBe(900);
    expect(bands[2].medianVisibleMs).toBeNull();
  });

  it('derives exits from the deepest point reached', () => {
    const out = aggregateInterest([
      visit({ maxScrollPct: 100 }),
      visit({ maxScrollPct: 42 }),
    ]);
    const bands = out.get('p1')!.bands;
    expect(bands[DEPTH_BANDS - 1].exits).toBe(1);
    expect(bands[8].exits).toBe(1);
  });

  it('counts interactions into the band they name and ignores unusable ones', () => {
    const out = aggregateInterest([visit({ interactions: ['3:cta', '99:cta', 'junk'] })]);
    const bands = out.get('p1')!.bands;
    expect(bands[3].interactions).toBe(1);
    expect(bands.reduce((n, b) => n + b.interactions, 0)).toBe(1);
  });

  it('reports no page height when no row measured one', () => {
    // Every one of these visits is classified under the fixed-percentage
    // fallback, which the panel has to be able to disclose.
    const out = aggregateInterest([visit({ viewportPct: null }), visit({ viewportPct: null })]);
    expect(out.get('p1')!.screensTall).toBeNull();
    expect(out.get('p1')!.screensCoverage).toBe(0);
  });

  it('ignores a wrong-length dwellByDepth and reports the measured population', () => {
    const good = new Array(DEPTH_BANDS).fill(0);
    good[0] = 900;
    const out = aggregateInterest([
      visit({ dwellByDepth: good }),
      visit({ dwellByDepth: new Array(DEPTH_BANDS - 1).fill(5_000) }),
    ]);
    const agg = out.get('p1')!;
    expect(agg.uv).toBe(2);
    expect(agg.measuredRows).toBe(1);
    expect(agg.bands).toHaveLength(DEPTH_BANDS);
    expect(agg.bands[0].reached).toBe(1);
    expect(agg.bands[0].medianVisibleMs).toBe(900);
    expect(agg.bands[1].reached).toBe(0);
  });

  it('counts a visitor once per band however many times they acted there', () => {
    const out = aggregateInterest([visit({ interactions: ['3:cta', '3:expand'] })]);
    expect(out.get('p1')!.bands[3].interactions).toBe(1);
  });

  it('refuses to name a funnel for a page shared by several', () => {
    const out = aggregateInterest([visit({ funnelId: 'f1' }), visit({ funnelId: 'f2' })]);
    expect(out.get('p1')!.funnelId).toBeNull();
    expect(out.get('p1')!.funnelCount).toBe(2);
  });

  it('handles an empty input', () => {
    expect(aggregateInterest([]).size).toBe(0);
  });
});
