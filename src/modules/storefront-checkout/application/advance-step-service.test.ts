import { describe, it, expect, vi } from 'vitest';
import { FunnelSession } from '../domain/funnel-session';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { AdvanceStepService } from './advance-step-service';

function session() {
  return FunnelSession.start({
    sessionId: 'sess_1', tenantId: 'default', snapshotRef: FunnelSnapshotRef.of('fn_1', 1),
    stepSlugs: [StepSlug.of('checkout'), StepSlug.of('upsell-1'), StepSlug.of('thankyou')],
    attribution: AttributionSnapshot.empty('sess_1'), entryStep: StepSlug.of('checkout'),
  });
}

describe('AdvanceStepService', () => {
  it('routes to the next step in the pinned snapshot and re-stores', async () => {
    const s = session();
    const deps = { sessions: { load: vi.fn(async () => s), store: vi.fn(async () => {}) }, ttlSeconds: 3600 };
    const svc = new AdvanceStepService(deps as any);
    const next = await svc.execute('sess_1', 'completed');
    expect(next).toBe('upsell-1');
    expect(s.currentStep.value).toBe('upsell-1');
    expect(deps.sessions.store).toHaveBeenCalled();
  });
});
