import { describe, it, expect } from 'vitest';
import {
  aggregateFunnelList,
  sortFunnelList,
  paginate,
  pageNumbers,
  computeStepDiagram,
  eventTypesForPageType,
  buildFunnelViewUrl,
  funnelRoleOf,
  stepsToPages,
} from '@/lib/dashboard/funnels-helpers';

const NOW = new Date('2026-04-24T12:00:00Z');

describe('aggregateFunnelList', () => {
  it('returns rows with zero counts on empty input', () => {
    const rows = aggregateFunnelList({
      funnels: [{ id: 'f1', name: 'A', pages: [] }],
      visits24h: [],
      orders24h: [],
      visits7d: [],
      now: NOW,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].visits24h).toBe(0);
    expect(rows[0].orders24h).toBe(0);
    expect(rows[0].convPct).toBe(0);
    expect(rows[0].pageCount).toBe(0);
    expect(rows[0].trend).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('counts visits, orders and computes conversion using checkout views', () => {
    const rows = aggregateFunnelList({
      funnels: [
        {
          id: 'f1',
          name: 'A',
          pages: [
            { pageType: 'LANDING' },
            { pageType: 'CHECKOUT' },
          ],
        },
      ],
      visits24h: [
        { funnelId: 'f1', createdAt: NOW, eventType: 'PAGE_VIEW_LP' },
        { funnelId: 'f1', createdAt: NOW, eventType: 'PAGE_VIEW_CHECKOUT' },
        { funnelId: 'f1', createdAt: NOW, eventType: 'PAGE_VIEW_CHECKOUT' },
        { funnelId: 'f1', createdAt: NOW, eventType: 'PAGE_VIEW_CHECKOUT' },
        { funnelId: 'f1', createdAt: NOW, eventType: 'PAGE_VIEW_CHECKOUT' },
      ],
      orders24h: [
        { funnelId: 'f1', createdAt: NOW },
      ],
      visits7d: [],
      now: NOW,
    });
    expect(rows[0].visits24h).toBe(5);
    expect(rows[0].orders24h).toBe(1);
    expect(rows[0].pageCount).toBe(2);
    expect(rows[0].convPct).toBe(25);
  });

  it('marks hasErrorPage based on funnel pages', () => {
    const rows = aggregateFunnelList({
      funnels: [
        { id: 'f1', name: 'A', pages: [{ pageType: 'CHECKOUT' }, { pageType: 'ERROR' }] },
        { id: 'f2', name: 'B', pages: [{ pageType: 'CHECKOUT' }] },
      ],
      visits24h: [],
      orders24h: [],
      visits7d: [],
      now: NOW,
    });
    expect(rows.find((r) => r.id === 'f1')!.hasErrorPage).toBe(true);
    expect(rows.find((r) => r.id === 'f2')!.hasErrorPage).toBe(false);
  });

  it('flags status=warn when funnel id is in needsRetry set', () => {
    const rows = aggregateFunnelList({
      funnels: [{ id: 'f1', name: 'A', pages: [] }],
      visits24h: [],
      orders24h: [],
      visits7d: [],
      needsRetry: new Set(['f1']),
      now: NOW,
    });
    expect(rows[0].status).toBe('warn');
  });

  it('builds 7-day trend with most recent day at the end', () => {
    const rows = aggregateFunnelList({
      funnels: [{ id: 'f1', name: 'A', pages: [] }],
      visits24h: [],
      orders24h: [],
      visits7d: [
        { funnelId: 'f1', createdAt: new Date('2026-04-24T01:00:00Z') }, // today
        { funnelId: 'f1', createdAt: new Date('2026-04-23T01:00:00Z') }, // 1d ago
        { funnelId: 'f1', createdAt: new Date('2026-04-23T05:00:00Z') }, // 1d ago
      ],
      now: NOW,
    });
    expect(rows[0].trend).toHaveLength(7);
    expect(rows[0].trend[6]).toBe(1);
    expect(rows[0].trend[5]).toBe(2);
  });
});

describe('sortFunnelList', () => {
  const rows = [
    { id: 'f1', name: 'B', pageCount: 2, hasErrorPage: true, visits24h: 10, orders24h: 1, conv: '10.00%', convPct: 10, trend: [], status: 'ok' as const },
    { id: 'f2', name: 'A', pageCount: 1, hasErrorPage: false, visits24h: 30, orders24h: 5, conv: '16.67%', convPct: 16.67, trend: [], status: 'ok' as const },
    { id: 'f3', name: 'C', pageCount: 3, hasErrorPage: true, visits24h: 20, orders24h: 0, conv: '0.00%', convPct: 0, trend: [], status: 'ok' as const },
  ];
  it('sorts by name asc', () => {
    expect(sortFunnelList(rows, 'name', 'asc').map((r) => r.id)).toEqual(['f2', 'f1', 'f3']);
  });
  it('sorts by visits desc', () => {
    expect(sortFunnelList(rows, 'visits', 'desc').map((r) => r.id)).toEqual(['f2', 'f3', 'f1']);
  });
  it('sorts by conv desc', () => {
    expect(sortFunnelList(rows, 'conv', 'desc').map((r) => r.id)).toEqual(['f2', 'f1', 'f3']);
  });
});

describe('paginate', () => {
  const rows = Array.from({ length: 23 }, (_, i) => i);
  it('clamps page to valid range', () => {
    expect(paginate(rows, 0, 10).page).toBe(1);
    expect(paginate(rows, 99, 10).page).toBe(3);
  });
  it('returns correct slice and totalPages', () => {
    const r = paginate(rows, 2, 10);
    expect(r.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(r.totalPages).toBe(3);
    expect(r.total).toBe(23);
  });
});

describe('pageNumbers', () => {
  it('returns full sequence when total <= 7', () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('inserts ellipsis around current when total > 7', () => {
    expect(pageNumbers(5, 12)).toEqual([1, '...', 4, 5, 6, '...', 12]);
    expect(pageNumbers(1, 12)).toEqual([1, 2, '...', 12]);
    expect(pageNumbers(12, 12)).toEqual([1, '...', 11, 12]);
  });
});

describe('computeStepDiagram', () => {
  it('orders steps LANDING -> CHECKOUT -> UPSELL -> THANKYOU and excludes ERROR', () => {
    const r = computeStepDiagram({
      pageTypes: ['ERROR', 'CHECKOUT', 'LANDING', 'THANKYOU', 'UPSELL'],
      visits: [
        { eventType: 'PAGE_VIEW_LP' }, { eventType: 'PAGE_VIEW_LP' }, { eventType: 'PAGE_VIEW_LP' }, { eventType: 'PAGE_VIEW_LP' }, // 4
        { eventType: 'PAGE_VIEW_CHECKOUT' }, { eventType: 'PAGE_VIEW_CHECKOUT' }, // 2
        { eventType: 'PAGE_VIEW_UPSELL' }, // 1
        { eventType: 'PAGE_VIEW_THANKYOU' }, // 1
        { eventType: 'PAGE_VIEW_ERROR' }, // excluded
      ],
    });
    expect(r.steps.map((s) => s.pageType)).toEqual(['LANDING', 'CHECKOUT', 'UPSELL', 'THANKYOU']);
    expect(r.steps[0].count).toBe(4);
    expect(r.steps[1].count).toBe(2);
    expect(r.steps[1].dropFromPrev).toBe(2);
    expect(r.steps[1].dropPctFromPrev).toBe('50.0%');
    expect(r.totalEnter).toBe(4);
    expect(r.totalConvert).toBe(1);
    expect(r.overallConvPct).toBe(25);
  });

  it('returns empty steps when funnel has no pages', () => {
    const r = computeStepDiagram({ pageTypes: [], visits: [] });
    expect(r.steps).toEqual([]);
    expect(r.totalEnter).toBe(0);
    expect(r.overallConvPct).toBe(0);
  });

  it('barWidthPct is normalized to the max step', () => {
    const r = computeStepDiagram({
      pageTypes: ['LANDING', 'CHECKOUT'],
      visits: [
        { eventType: 'PAGE_VIEW_LP' }, { eventType: 'PAGE_VIEW_LP' }, { eventType: 'PAGE_VIEW_LP' }, { eventType: 'PAGE_VIEW_LP' },
        { eventType: 'PAGE_VIEW_CHECKOUT' },
      ],
    });
    expect(r.steps[0].barWidthPct).toBe(100);
    expect(r.steps[1].barWidthPct).toBe(25);
  });
});

describe('buildFunnelViewUrl', () => {
  it('uses the landing page public URL, not the step-advance redirect', () => {
    const url = buildFunnelViewUrl({
      funnelId: 'f1',
      primaryHost: 'shop.example.com',
      pages: [
        { pageType: 'LANDING', order: 0, subOrder: 0, stepSlug: 'lp', pageSlug: '/lp' },
        { pageType: 'CHECKOUT', order: 1, subOrder: 0, stepSlug: 'co', pageSlug: '/co' },
      ],
    });
    expect(url).toBe('https://shop.example.com/lp');
  });

  it('falls back to the /n redirect only when the page slug is unknown', () => {
    const url = buildFunnelViewUrl({
      funnelId: 'f1',
      primaryHost: 'shop.example.com',
      pages: [
        { pageType: 'LANDING', order: 0, subOrder: 0, stepSlug: 'lp', pageSlug: null },
      ],
    });
    expect(url).toBe('/n/f1/lp');
  });

  it('falls back to landing absolute slug when stepSlug missing', () => {
    const url = buildFunnelViewUrl({
      funnelId: 'f1',
      primaryHost: 'shop.example.com',
      pages: [
        { pageType: 'LANDING', order: 0, subOrder: 0, stepSlug: null, pageSlug: '/lp' },
      ],
    });
    expect(url).toBe('https://shop.example.com/lp');
  });

  it('falls back to checkout when no landing exists', () => {
    const url = buildFunnelViewUrl({
      funnelId: 'f1',
      primaryHost: 'shop.example.com',
      pages: [
        { pageType: 'CHECKOUT', order: 0, subOrder: 0, stepSlug: null, pageSlug: '/co' },
      ],
    });
    expect(url).toBe('https://shop.example.com/co');
  });

  it('uses the local /storefront render URL when no primary host is configured', () => {
    const url = buildFunnelViewUrl({
      funnelId: 'f1',
      primaryHost: null,
      pages: [
        { pageType: 'LANDING', order: 0, subOrder: 0, stepSlug: 'lp', pageSlug: '/lp' },
      ],
    });
    expect(url).toBe('/storefront/lp');
  });

  it('returns null when no usable url can be built', () => {
    const url = buildFunnelViewUrl({
      funnelId: 'f1',
      primaryHost: null,
      pages: [
        { pageType: 'CHECKOUT', order: 0, subOrder: 0, stepSlug: null, pageSlug: null },
      ],
    });
    expect(url).toBeNull();
  });

  it('uses http for localhost host', () => {
    const url = buildFunnelViewUrl({
      funnelId: 'f1',
      primaryHost: 'localhost:4321',
      pages: [
        { pageType: 'LANDING', order: 0, subOrder: 0, stepSlug: null, pageSlug: '/lp' },
      ],
    });
    expect(url).toBe('http://localhost:4321/lp');
  });
});

describe('funnelRoleOf', () => {
  it('maps CUSTOM to the LANDING funnel role', () => {
    expect(funnelRoleOf('CUSTOM')).toBe('LANDING');
    expect(funnelRoleOf('custom')).toBe('LANDING');
  });
  it('maps stored page types to their funnel roles', () => {
    expect(funnelRoleOf('CHECKOUT')).toBe('CHECKOUT');
    expect(funnelRoleOf('THANKYOU')).toBe('THANKYOU');
    expect(funnelRoleOf('UPSELL')).toBe('UPSELL');
    expect(funnelRoleOf('ERROR')).toBe('ERROR');
  });
  it('returns null for unknown or missing types', () => {
    expect(funnelRoleOf('WAT')).toBeNull();
    expect(funnelRoleOf(null)).toBeNull();
    expect(funnelRoleOf(undefined)).toBeNull();
  });
});

describe('stepsToPages', () => {
  it('derives funnel role from the resolved page type, not step position', () => {
    // Reproduces the real funnel: createFunnelWithDefaults prepends thankyou + error steps,
    // then the user appends checkout + upsell — so thankyou sits at index 0.
    const steps = [
      { stepSlug: 'thank-you', pageId: 'p_ty' },
      { stepSlug: 'error', pageId: 'p_err' },
      { stepSlug: 'checkout', pageId: 'p_co' },
      { stepSlug: 'upsell', pageId: 'p_up' },
    ];
    const roles = new Map([
      ['p_ty', 'THANKYOU'],
      ['p_err', 'ERROR'],
      ['p_co', 'CHECKOUT'],
      ['p_up', 'UPSELL'],
    ]);
    const pages = stepsToPages(steps, roles);
    expect(pages.map((p) => p.pageType)).toEqual(['THANKYOU', 'ERROR', 'CHECKOUT', 'UPSELL']);
  });

  it('defaults to LANDING when no role is resolved', () => {
    const pages = stepsToPages([{ stepSlug: 'a', pageId: 'p1' }, { stepSlug: 'b', pageId: 'p2' }]);
    expect(pages.map((p) => p.pageType)).toEqual(['LANDING', 'LANDING']);
  });
});

describe('funnel entry URL — regression: thankyou step at index 0', () => {
  // A funnel created with defaults then given checkout + upsell stores its steps in this order.
  const steps = [
    { stepSlug: 'thank-you', pageId: 'p_ty' },
    { stepSlug: 'error', pageId: 'p_err' },
    { stepSlug: 'checkout', pageId: 'p_co' },
    { stepSlug: 'upsell', pageId: 'p_up' },
  ];
  const roles = new Map([
    ['p_ty', 'THANKYOU'],
    ['p_err', 'ERROR'],
    ['p_co', 'CHECKOUT'],
    ['p_up', 'UPSELL'],
  ]);
  const slugById = new Map([
    ['p_ty', '/thank-you'],
    ['p_err', '/error'],
    ['p_co', '/checkout'],
    ['p_up', '/upsell'],
  ]);

  it('picks the checkout page, never the thankyou page, as the entry URL', () => {
    const pages = stepsToPages(steps, roles).map((p) => ({
      pageType: p.pageType,
      order: p.order,
      subOrder: p.subOrder,
      stepSlug: p.stepSlug,
      pageSlug: slugById.get(p.pageId) ?? null,
    }));
    const url = buildFunnelViewUrl({ funnelId: 'f1', primaryHost: 'shop.example.com', pages });
    expect(url).toBe('https://shop.example.com/checkout');
  });

  it('prefers a landing page over checkout once one is added', () => {
    const withLanding = [{ stepSlug: 'lp', pageId: 'p_lp' }, ...steps];
    const rolesWithLanding = new Map(roles);
    rolesWithLanding.set('p_lp', 'LANDING');
    const slugs = new Map(slugById);
    slugs.set('p_lp', '/lp');
    const pages = stepsToPages(withLanding, rolesWithLanding).map((p) => ({
      pageType: p.pageType,
      order: p.order,
      subOrder: p.subOrder,
      stepSlug: p.stepSlug,
      pageSlug: slugs.get(p.pageId) ?? null,
    }));
    const url = buildFunnelViewUrl({ funnelId: 'f1', primaryHost: 'shop.example.com', pages });
    expect(url).toBe('https://shop.example.com/lp');
  });

  it('reports hasErrorPage=true once the page roles are resolved', () => {
    const pages = stepsToPages(steps, roles).map((p) => ({ pageType: p.pageType }));
    const rows = aggregateFunnelList({
      funnels: [{ id: 'f1', name: 'A', pages }],
      visits24h: [],
      orders24h: [],
      visits7d: [],
      now: NOW,
    });
    expect(rows[0].hasErrorPage).toBe(true);
  });
});

describe('eventTypesForPageType', () => {
  it('returns LP variants for LANDING', () => {
    expect(eventTypesForPageType('LANDING')).toContain('PAGE_VIEW_LP');
    expect(eventTypesForPageType('LANDING')).toContain('PAGE_VIEW_LP1');
  });
  it('returns empty for unknown type', () => {
    expect(eventTypesForPageType('UNKNOWN')).toEqual([]);
  });
});
