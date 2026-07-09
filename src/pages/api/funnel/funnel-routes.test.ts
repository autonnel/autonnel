import { describe, it, expect, vi } from 'vitest';

const composing = {
  addStep: vi.fn().mockResolvedValue(undefined),
  removeStep: vi.fn().mockResolvedValue(undefined),
  replaceStep: vi.fn().mockResolvedValue(undefined),
  setStepSlug: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/composition/make-authoring', () => ({
  makeAuthoring: () => ({
    funnelComposing: composing,
  }),
}));
vi.mock('@/modules/identity/published/principal', () => ({ requireFeature: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/composition/authoring-runtime', () => ({ authoringDepsFromLocals: () => ({}) }));

import { DELETE as StepDelete, PUT as StepPut, PATCH as StepPatch } from './[funnelId]/page';

function req(body: unknown) {
  return new Request('http://test/api/funnel/f1/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('funnel step mutations', () => {
  it('DELETE removes the step by funnelPageId', async () => {
    const res = await StepDelete({ request: req({ funnelPageId: 'p1' }), params: { funnelId: 'f1' }, locals: {} } as never);
    expect(res.status).toBe(200);
    expect(composing.removeStep).toHaveBeenCalledWith({ funnelId: 'f1', pageId: 'p1' });
  });

  it('DELETE 400s without funnelPageId', async () => {
    const res = await StepDelete({ request: req({}), params: { funnelId: 'f1' }, locals: {} } as never);
    expect(res.status).toBe(400);
  });

  it('PUT replaces the step page', async () => {
    const res = await StepPut({ request: req({ funnelPageId: 'old', pageId: 'new' }), params: { funnelId: 'f1' }, locals: {} } as never);
    expect(res.status).toBe(200);
    expect(composing.replaceStep).toHaveBeenCalledWith({ funnelId: 'f1', fromPageId: 'old', toPageId: 'new' });
  });

  it('PATCH updates the step slug', async () => {
    const res = await StepPatch({ request: req({ funnelPageId: 'p1', stepSlug: 'upsell' }), params: { funnelId: 'f1' }, locals: {} } as never);
    expect(res.status).toBe(200);
    expect(composing.setStepSlug).toHaveBeenCalledWith({ funnelId: 'f1', pageId: 'p1', stepSlug: 'upsell' });
  });
});
