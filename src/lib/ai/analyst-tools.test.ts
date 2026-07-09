import { describe, it, expect, vi } from 'vitest';
import { createAnalystTools, type AnalystToolsDeps } from './analyst-tools';

function baseDeps(overrides: Partial<AnalystToolsDeps> = {}): AnalystToolsDeps {
  return {
    listFunnels: async () => [
      { funnelId: 'f1', name: 'Funnel One', sessions: 100, conversions: 10, conversionRate: 0.1 },
    ],
    funnelMetrics: async (id) =>
      id === 'f1'
        ? {
            funnelId: 'f1',
            stages: [{ key: 'checkout', label: 'Checkout', value: 50, conversionPct: 50, dropPct: 50 }],
            upsells: [],
            revenue: 999,
            orders: 10,
            visitors: 100,
            overallCvr: 10,
            aov: 99.9,
          }
        : null,
    queryOrders: async () => ({
      statusBreakdown: { PAID: 10 },
      paidOrders: 10,
      ordersCount: 12,
      revenue: 999,
      aov: 99.9,
      refunds: 1,
      sample: [{ orderNumber: '1001', status: 'PAID', amount: 99.9, currencyCode: 'USD', createdAt: 'now' }],
    }),
    resolvePageScreenshotUrl: async () => 'https://shop.example.com/n/f1/checkout',
    getPageContent: async (id) =>
      id === 'p1' ? { editorType: 'PUCK', components: [{ type: 'HeroPanel', text: 'Buy now' }] } : null,
    ...overrides,
  };
}

async function call(t: any, input: unknown) {
  return t.execute(input, { toolCallId: 't', messages: [] });
}

describe('createAnalystTools', () => {
  it('getFunnelList returns the funnel list from deps', async () => {
    const { tools } = createAnalystTools(baseDeps());
    const out = await call(tools.getFunnelList, {});
    expect(out.funnels).toHaveLength(1);
    expect(out.funnels[0].funnelId).toBe('f1');
  });

  it('getFunnelMetrics returns metrics or an error for unknown funnel', async () => {
    const { tools } = createAnalystTools(baseDeps());
    const ok = await call(tools.getFunnelMetrics, { funnelId: 'f1' });
    expect(ok.revenue).toBe(999);
    const miss = await call(tools.getFunnelMetrics, { funnelId: 'nope' });
    expect(miss.error).toContain('not found');
  });

  it('getOrders forwards args and returns the breakdown', async () => {
    const queryOrders = vi.fn(baseDeps().queryOrders);
    const { tools } = createAnalystTools(baseDeps({ queryOrders }));
    const out = await call(tools.getOrders, { status: 'PAID', limit: 5 });
    expect(queryOrders).toHaveBeenCalledWith({ status: 'PAID', limit: 5 });
    expect(out.paidOrders).toBe(10);
  });

  it('getPageContent caps GrapesJS html length', async () => {
    const longHtml = 'x'.repeat(9000);
    const { tools } = createAnalystTools(
      baseDeps({ getPageContent: async () => ({ editorType: 'GRAPESJS', html: longHtml }) }),
    );
    const out = await call(tools.getPageContent, { pageId: 'p2' });
    expect(out.html.length).toBe(8000);
  });

  it('omits screenshotPage when no screenshot dep is provided', () => {
    const { tools } = createAnalystTools(baseDeps());
    expect(tools.screenshotPage).toBeUndefined();
  });

  it('registers screenshotPage when screenshot dep is provided', async () => {
    const screenshot = vi.fn(async () => ({ base64: 'AAAA', contentType: 'image/png' }));
    const { tools } = createAnalystTools(baseDeps({ screenshot }));
    expect(tools.screenshotPage).toBeDefined();
    const out = await call(tools.screenshotPage, { funnelId: 'f1', step: 'checkout' });
    expect(screenshot).toHaveBeenCalledWith('https://shop.example.com/n/f1/checkout');
    expect(out.base64).toBe('AAAA');
  });

  it('screenshotPage rejects when neither funnelId nor pageId given (SSRF guard)', async () => {
    const screenshot = vi.fn(async () => ({ base64: 'AAAA', contentType: 'image/png' }));
    const { tools } = createAnalystTools(baseDeps({ screenshot }));
    const out = await call(tools.screenshotPage, {});
    expect(out.error).toBeDefined();
    expect(screenshot).not.toHaveBeenCalled();
  });

  it('screenshotPage toModelOutput returns image content for the model', () => {
    const screenshot = vi.fn(async () => ({ base64: 'AAAA', contentType: 'image/png' }));
    const { tools } = createAnalystTools(baseDeps({ screenshot }));
    const out = tools.screenshotPage.toModelOutput({
      toolCallId: 't',
      input: { funnelId: 'f1' },
      output: { url: 'u', base64: 'AAAA', contentType: 'image/png' },
    });
    expect(out.type).toBe('content');
    expect(out.value[0]).toEqual({ type: 'image-data', data: 'AAAA', mediaType: 'image/png' });
  });
});
