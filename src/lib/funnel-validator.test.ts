import { describe, it, expect, vi, beforeEach } from 'vitest';

const funnelFindFirst = vi.fn();
const pageFindFirst = vi.fn();

vi.mock('./db', () => ({
  getBasePrisma: () => ({
    funnel: { findFirst: funnelFindFirst },
    page: { findFirst: pageFindFirst },
  }),
}));
vi.mock('./repositories/tenant-helpers', () => ({
  withTenantWhere: (where: Record<string, unknown>) => where,
}));

import { validateFunnel } from './funnel-validator';

const FUNNEL_ID = 'fnl1';

function pageById(pages: Record<string, any>) {
  return (args: { where: { id: string } }) => Promise.resolve(pages[args.where.id] ?? null);
}

beforeEach(() => {
  funnelFindFirst.mockReset();
  pageFindFirst.mockReset();
});

describe('validateFunnel redirect-link rule', () => {
  it('only requires a redirect link on landing (custom) steps, not checkout/thankyou/error', async () => {
    funnelFindFirst.mockResolvedValue({
      id: FUNNEL_ID,
      steps: [
        { stepSlug: 'landing', pageId: 'p-landing' },
        { stepSlug: 'checkout-wellness', pageId: 'p-checkout' },
        { stepSlug: 'thank-you', pageId: 'p-thankyou' },
        { stepSlug: 'error', pageId: 'p-error' },
      ],
    });
    pageFindFirst.mockImplementation(
      pageById({
        'p-landing': {
          id: 'p-landing',
          name: 'Landing',
          type: 'custom',
          publishedData: { content: [{ props: { href: `/n/${FUNNEL_ID}/landing` } }] },
          draftData: null,
          htmlContent: null,
          draftHtml: null,
        },
        'p-checkout': { id: 'p-checkout', name: 'Checkout', type: 'CHECKOUT', publishedData: {}, draftData: null, htmlContent: null, draftHtml: null },
        'p-thankyou': { id: 'p-thankyou', name: 'Thank You', type: 'THANKYOU', publishedData: {}, draftData: null, htmlContent: null, draftHtml: null },
        'p-error': { id: 'p-error', name: 'Error', type: 'ERROR', publishedData: {}, draftData: null, htmlContent: null, draftHtml: null },
      }),
    );

    const result = await validateFunnel(FUNNEL_ID);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('finds the redirect link inside HTML-editor landing content (htmlContent), not just Puck data', async () => {
    funnelFindFirst.mockResolvedValue({
      id: FUNNEL_ID,
      steps: [
        { stepSlug: 'landing', pageId: 'p-landing' },
        { stepSlug: 'checkout-wellness', pageId: 'p-checkout' },
      ],
    });
    pageFindFirst.mockImplementation(
      pageById({
        'p-landing': {
          id: 'p-landing',
          name: 'HTML Landing',
          type: 'CUSTOM',
          publishedData: {},
          draftData: {},
          htmlContent: `<a href="/n/${FUNNEL_ID}/landing">Buy</a>`,
          draftHtml: null,
        },
        'p-checkout': { id: 'p-checkout', name: 'Checkout', type: 'CHECKOUT', publishedData: {}, draftData: null, htmlContent: null, draftHtml: null },
      }),
    );

    const result = await validateFunnel(FUNNEL_ID);
    expect(result.isValid).toBe(true);
  });

  it('flags a landing step that is missing the redirect link to its own step slug', async () => {
    funnelFindFirst.mockResolvedValue({
      id: FUNNEL_ID,
      steps: [
        { stepSlug: 'landing', pageId: 'p-landing' },
        { stepSlug: 'checkout-wellness', pageId: 'p-checkout' },
      ],
    });
    pageFindFirst.mockImplementation(
      pageById({
        'p-landing': {
          id: 'p-landing',
          name: 'Landing',
          type: 'custom',
          publishedData: {},
          draftData: {},
          htmlContent: `<a href="/n/${FUNNEL_ID}/checkout-wellness">Buy</a>`,
          draftHtml: null,
        },
        'p-checkout': { id: 'p-checkout', name: 'Checkout', type: 'CHECKOUT', publishedData: {}, draftData: null, htmlContent: null, draftHtml: null },
      }),
    );

    const result = await validateFunnel(FUNNEL_ID);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      pageId: 'p-landing',
      expectedUrl: `/n/${FUNNEL_ID}/landing`,
    });
  });

  it('reports a missing checkout step', async () => {
    funnelFindFirst.mockResolvedValue({
      id: FUNNEL_ID,
      steps: [{ stepSlug: 'landing', pageId: 'p-landing' }],
    });
    pageFindFirst.mockImplementation(
      pageById({
        'p-landing': { id: 'p-landing', name: 'Landing', type: 'custom', publishedData: {}, draftData: {}, htmlContent: '', draftHtml: null },
      }),
    );

    const result = await validateFunnel(FUNNEL_ID);
    expect(result.errors.some((e) => e.pageType === 'CHECKOUT')).toBe(true);
  });
});
