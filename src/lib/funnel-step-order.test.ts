import { describe, it, expect } from 'vitest';
import { orderStepsByWorkflow, nextStepInWorkflow, workflowRankForType } from './funnel-step-order';

type Step = { stepSlug: string; pageId: string };
const types = (m: Record<string, string>) => new Map<string, string | null>(Object.entries(m));

describe('funnel-step-order', () => {
  it('ranks landing < checkout < upsell < thankyou < error, case-insensitively', () => {
    expect(workflowRankForType('CUSTOM')).toBeLessThan(workflowRankForType('CHECKOUT'));
    expect(workflowRankForType('checkout')).toBeLessThan(workflowRankForType('upsell'));
    expect(workflowRankForType('UPSELL')).toBeLessThan(workflowRankForType('THANKYOU'));
    expect(workflowRankForType('thankyou')).toBeLessThan(workflowRankForType('ERROR'));
  });

  // The reported bug: upsell appended after thankyou in the stored array.
  it('routes checkout → upsell → thankyou even when the upsell is appended last', () => {
    const steps: Step[] = [
      { stepSlug: 'landing', pageId: 'pL' },
      { stepSlug: 'checkout', pageId: 'pC' },
      { stepSlug: 'thankyou', pageId: 'pT' },
      { stepSlug: 'error', pageId: 'pE' },
      { stepSlug: 'upsell', pageId: 'pU' },
    ];
    const t = types({ pL: 'CUSTOM', pC: 'CHECKOUT', pT: 'THANKYOU', pE: 'ERROR', pU: 'UPSELL' });

    expect(nextStepInWorkflow(steps, t, 'pC').next?.pageId).toBe('pU'); // checkout → upsell (was thankyou)
    expect(nextStepInWorkflow(steps, t, 'pU').next?.pageId).toBe('pT'); // upsell → thankyou (was null)
    expect(nextStepInWorkflow(steps, t, 'pT').next?.pageId).toBe('pE'); // thankyou → error
    expect(nextStepInWorkflow(steps, t, 'pE').next).toBeNull();          // error is last
    expect(nextStepInWorkflow(steps, t, 'pL').position).toBe(0);         // landing is the entry
  });

  it('preserves array order among same-rank steps (upsell1 before upsell2)', () => {
    const steps: Step[] = [
      { stepSlug: 'u2', pageId: 'pU2' },
      { stepSlug: 'checkout', pageId: 'pC' },
      { stepSlug: 'u1', pageId: 'pU1' },
    ];
    const t = types({ pC: 'CHECKOUT', pU1: 'UPSELL', pU2: 'UPSELL' });
    const ordered = orderStepsByWorkflow(steps, t).map((s) => s.pageId);
    expect(ordered).toEqual(['pC', 'pU2', 'pU1']); // checkout first, then upsells in original order
    expect(nextStepInWorkflow(steps, t, 'pC').next?.pageId).toBe('pU2');
    expect(nextStepInWorkflow(steps, t, 'pU2').next?.pageId).toBe('pU1');
  });

  it('sorts unknown/orphaned-page steps last', () => {
    const steps: Step[] = [
      { stepSlug: 'ghost', pageId: 'gone' },
      { stepSlug: 'checkout', pageId: 'pC' },
    ];
    const t = types({ pC: 'CHECKOUT' }); // 'gone' has no type
    expect(orderStepsByWorkflow(steps, t).map((s) => s.pageId)).toEqual(['pC', 'gone']);
  });
});
