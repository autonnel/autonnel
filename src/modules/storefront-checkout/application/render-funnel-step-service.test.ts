import { describe, it, expect, vi } from 'vitest';
import { RenderFunnelStepService } from './render-funnel-step-service';

const snapshot = {
  funnelId: 'fn_1', version: 2, entryStep: 'checkout',
  stepSlugs: ['checkout', 'upsell-1', 'thankyou'],
  pageHtmlByStep: { checkout: '<main>checkout</main>', 'upsell-1': '<main>up</main>', thankyou: '<main>ty</main>' },
};

describe('RenderFunnelStepService', () => {
  it('renders the published HTML for a known step and starts a session when none exists', async () => {
    const stored: any[] = [];
    const svc = new RenderFunnelStepService({
      snapshots: { loadByStepSlug: vi.fn(async () => snapshot), loadPinned: vi.fn() } as any,
      sessions: { load: vi.fn(async () => null), store: vi.fn(async (s) => stored.push(s)), signCookieValue: vi.fn(async () => 'c'), verifyCookieValue: vi.fn(async () => null) } as any,
      attribution: { read: vi.fn(async () => null) } as any,
      newSessionId: () => 'sess_new',
      tenantId: 'default',
      ttlSeconds: 3600,
    });
    const out = await svc.renderStep('checkout', null);
    expect(out.html).toBe('<main>checkout</main>');
    expect(out.funnelId).toBe('fn_1');
    expect(out.version).toBe(2);
    expect(out.currentStep).toBe('checkout');
    expect(stored).toHaveLength(1);
  });

  it('404s (throws NotFound) for an unknown step', async () => {
    const svc = new RenderFunnelStepService({
      snapshots: { loadByStepSlug: vi.fn(async () => null), loadPinned: vi.fn() } as any,
      sessions: { load: vi.fn(), store: vi.fn(), signCookieValue: vi.fn(), verifyCookieValue: vi.fn() } as any,
      attribution: { read: vi.fn() } as any,
      newSessionId: () => 'x', tenantId: 'default', ttlSeconds: 3600,
    });
    await expect(svc.renderStep('ghost', null)).rejects.toThrow(/not found/i);
  });
});
