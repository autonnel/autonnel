import { describe, it, expect } from 'vitest';
import { StepSlug } from '../value-objects/funnel-snapshot-ref';
import { StepRoutingPolicy } from './step-routing-policy';

const steps = [StepSlug.of('landing'), StepSlug.of('checkout'), StepSlug.of('upsell-1'), StepSlug.of('thankyou')];

describe('StepRoutingPolicy', () => {
  const policy = new StepRoutingPolicy();

  it('advances to the next ordinal on completed', () => {
    const next = policy.nextStep(StepSlug.of('checkout'), 'completed', steps);
    expect(next.value).toBe('upsell-1');
  });

  it('advances to thankyou after the last pre-terminal step', () => {
    const next = policy.nextStep(StepSlug.of('upsell-1'), 'declined', steps);
    expect(next.value).toBe('thankyou');
  });

  it('throws for a current step not in the snapshot', () => {
    expect(() => policy.nextStep(StepSlug.of('ghost'), 'completed', steps)).toThrow(/snapshot/i);
  });
});
