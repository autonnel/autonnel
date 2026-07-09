import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    funnel: { findFirst: vi.fn() },
    page: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  getBasePrisma: () => prismaMock,
}));

vi.mock('@/lib/tenant/context', () => ({
  getCurrentTenantId: () => 'default',
}));

import { validateFunnel, getFunnelValidationErrors } from '@/lib/funnel-validator';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('funnel-validator', () => {
  it('throws when funnel does not exist', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue(null);
    await expect(validateFunnel('nonexistent')).rejects.toThrow(/not found/);
  });

  it('returns isValid when landing links resolve and a checkout step exists', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'f1',
      steps: [
        { stepSlug: 'l1', pageId: 'p1' },
        { stepSlug: 'co', pageId: 'p2' },
      ],
    });
    prismaMock.page.findFirst.mockImplementation(async (args: any) => ({
      id: args.where.id,
      name: 'P',
      type: args.where.id === 'p2' ? 'CHECKOUT' : 'LANDING',
      publishedData: { html: 'link to /n/f1/co' },
      draftData: null,
    }));

    const r = await validateFunnel('f1');
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('reports a checkout-required error when no step references a checkout page', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'f1',
      steps: [{ stepSlug: 'ty', pageId: 'p1' }],
    });
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'p1', name: 'Thank You', type: 'THANKYOU', publishedData: {}, draftData: null,
    });

    const errs = await getFunnelValidationErrors('f1');
    const checkoutErr = errs.find((e) => e.pageType === 'CHECKOUT');
    expect(checkoutErr).toBeDefined();
    expect(checkoutErr!.error).toMatch(/no checkout step/i);
  });

  it('does NOT report a checkout-required error when a checkout step is present', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'f1',
      steps: [{ stepSlug: 'co', pageId: 'p1' }],
    });
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'p1', name: 'Checkout', type: 'CHECKOUT', publishedData: {}, draftData: null,
    });

    const errs = await getFunnelValidationErrors('f1');
    expect(errs.some((e) => e.pageType === 'CHECKOUT')).toBe(false);
  });

  it('matches lowercase checkout page types too', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'f1',
      steps: [{ stepSlug: 'co', pageId: 'p1' }],
    });
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'p1', name: 'Checkout', type: 'checkout', publishedData: {}, draftData: null,
    });

    const errs = await getFunnelValidationErrors('f1');
    expect(errs.some((e) => e.pageType === 'CHECKOUT')).toBe(false);
  });

  it('reports missing-page error when a referenced page no longer exists (plus checkout-required)', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'f1',
      steps: [{ stepSlug: 'l1', pageId: 'gone' }],
    });
    prismaMock.page.findFirst.mockResolvedValue(null);
    const r = await validateFunnel('f1');
    expect(r.errors.some((e) => e.error === 'Page not found')).toBe(true);
    expect(r.errors.some((e) => e.pageType === 'CHECKOUT')).toBe(true);
  });

  it('reports error when a landing page lacks its own step redirect link', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'f1',
      steps: [
        { stepSlug: 'l1', pageId: 'p1' },
        { stepSlug: 'co', pageId: 'p2' },
      ],
    });
    prismaMock.page.findFirst.mockImplementation(async (args: any) => ({
      id: args.where.id,
      name: 'P',
      type: args.where.id === 'p2' ? 'CHECKOUT' : 'custom',
      publishedData: { html: 'no link here' },
      draftData: null,
    }));
    const r = await validateFunnel('f1');
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.expectedUrl === '/n/f1/l1')).toBe(true);
  });

  it('getFunnelValidationErrors returns just the errors array', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'f1',
      steps: [{ stepSlug: 'co', pageId: 'p1' }],
    });
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'p1', name: 'Checkout', type: 'CHECKOUT', publishedData: {}, draftData: null,
    });
    const errs = await getFunnelValidationErrors('f1');
    expect(Array.isArray(errs)).toBe(true);
  });
});
