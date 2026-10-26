import { describe, it, expect } from 'vitest';
import { MAX_EVENTS_PER_STEP, aggregateFunnelSteps, resolveFunnelAdWindow } from './analytics-helpers';

const visits = (pageType: string, n: number) => Array.from({ length: n }, () => ({ pageType }));

describe('aggregateFunnelSteps custom events', () => {
  it('gives every step an empty events array when none are supplied', () => {
    const rows = aggregateFunnelSteps({ visits: visits('LANDING', 3) }, { dropEmpty: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].events).toEqual([]);
  });

  it('attaches events to the step whose page type they occurred on', () => {
    const rows = aggregateFunnelSteps(
      {
        visits: [...visits('LANDING', 10), ...visits('CHECKOUT', 4)],
        customEvents: [
          { pageType: 'LANDING', name: 'hero_cta', visitors: 5 },
          { pageType: 'CHECKOUT', name: 'coupon_help', visitors: 1 },
        ],
      },
      { dropEmpty: true },
    );

    const lp = rows.find((r) => r.key === 'lp1');
    const checkout = rows.find((r) => r.key === 'checkout');
    expect(lp?.events).toEqual([{ name: 'hero_cta', visitors: 5, sharePct: 50 }]);
    expect(checkout?.events).toEqual([{ name: 'coupon_help', visitors: 1, sharePct: 25 }]);
  });

  it('orders a step events by visitors descending', () => {
    const rows = aggregateFunnelSteps({
      visits: visits('LANDING', 10),
      customEvents: [
        { pageType: 'LANDING', name: 'low', visitors: 1 },
        { pageType: 'LANDING', name: 'high', visitors: 9 },
        { pageType: 'LANDING', name: 'mid', visitors: 4 },
      ],
    });
    const lp = rows.find((r) => r.key === 'lp1');
    expect(lp?.events.map((e) => e.name)).toEqual(['high', 'mid', 'low']);
  });

  it(`keeps at most ${MAX_EVENTS_PER_STEP} events per step`, () => {
    const rows = aggregateFunnelSteps({
      visits: visits('LANDING', 100),
      customEvents: Array.from({ length: 12 }, (_, i) => ({
        pageType: 'LANDING',
        name: `e${i}`,
        visitors: i + 1,
      })),
    });
    const lp = rows.find((r) => r.key === 'lp1');
    expect(lp?.events).toHaveLength(MAX_EVENTS_PER_STEP);
    expect(lp?.events[0].name).toBe('e11');
  });

  it('drops events whose page type matches no step', () => {
    const rows = aggregateFunnelSteps(
      {
        visits: visits('LANDING', 5),
        customEvents: [
          { pageType: null, name: 'orphan', visitors: 3 },
          { pageType: 'ERROR', name: 'error_page_click', visitors: 2 },
        ],
      },
      { dropEmpty: true },
    );
    expect(rows.flatMap((r) => r.events)).toEqual([]);
  });

  it('drops events belonging to a step that dropEmpty hid', () => {
    const rows = aggregateFunnelSteps(
      {
        visits: visits('LANDING', 5),
        customEvents: [{ pageType: 'CHECKOUT', name: 'ghost', visitors: 2 }],
      },
      { dropEmpty: true },
    );
    expect(rows.map((r) => r.key)).toEqual(['lp1']);
    expect(rows[0].events).toEqual([]);
  });

  it('reports a zero share rather than dividing by zero', () => {
    const rows = aggregateFunnelSteps({
      visits: [],
      customEvents: [{ pageType: 'LANDING', name: 'ghost', visitors: 3 }],
    });
    const lp = rows.find((r) => r.key === 'lp1');
    expect(lp?.events[0].sharePct).toBe(0);
  });

  it('merges rows that collapse to the same step and event name by summing visitors', () => {
    // Two differently-cased stepId spellings ("custom" and "CUSTOM") both normalize to the
    // LANDING role before reaching here, so two rows arrive with identical pageType and name.
    const rows = aggregateFunnelSteps({
      visits: visits('LANDING', 10),
      customEvents: [
        { pageType: 'LANDING', name: 'buy_now', visitors: 3 },
        { pageType: 'LANDING', name: 'buy_now', visitors: 2 },
      ],
    });
    const lp = rows.find((r) => r.key === 'lp1');
    expect(lp?.events).toEqual([{ name: 'buy_now', visitors: 5, sharePct: 50 }]);
  });
});

// IMPORTANT fix: the funnel Ad Performance panel used to hardcode `start: Date.now() - 7 days,
// end: now` in the .astro page, ignoring FunnelAnalyticsTab's own startDate/endDate query-string
// range picker entirely. Changing the tab's range then updated every other number on the page
// while the ad panel silently stayed on a fixed 7 days. resolveFunnelAdWindow is what the page now
// calls instead, so these tests pin its contract directly.
describe('resolveFunnelAdWindow', () => {
  it('uses the tab picker startDate/endDate when both are present, not a fixed 7-day window', () => {
    const w = resolveFunnelAdWindow({ startDate: '2026-09-01', endDate: '2026-09-03', timezone: 'UTC' });
    expect(w.range).toBe('custom');
    expect(w.startDateStr).toBe('2026-09-01');
    expect(w.endDateStr).toBe('2026-09-03');
  });

  it('falls back to a 7-day window, not resolveAnalyticsWindow default 24h, when the tab has no range yet', () => {
    const w = resolveFunnelAdWindow({ startDate: '', endDate: '', timezone: 'UTC' });
    expect(w.range).toBe('7d');
  });

  it('derives the calendar-day strings in the given site timezone, not UTC', () => {
    // Same fix-1 timezone bug applies here: the panel's window must resolve calendar days in the
    // site timezone, since loadAdReconciliation's SQL range is built from startDateStr/endDateStr.
    const w = resolveFunnelAdWindow({ startDate: '2026-09-05', endDate: '2026-09-05', timezone: 'Asia/Shanghai' });
    expect(w.startDateStr).toBe('2026-09-05');
    expect(w.endDateStr).toBe('2026-09-05');
  });
});
